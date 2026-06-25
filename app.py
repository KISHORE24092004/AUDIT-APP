import os
import json
from functools import wraps
from dotenv import load_dotenv
from flask import Flask, render_template, request, redirect, url_for, session, flash
from supabase import create_client, Client
from gotrue.errors import AuthApiError

# Load environment variables (override=True to prevent caching of session envs)
load_dotenv(override=True)

app = Flask(__name__)
# Generate or retrieve session key
app.secret_key = os.getenv("FLASK_SECRET_KEY", "flask_session_secret_key_9876543210")

# Local Mock Auth & Readings configuration
MOCK_AUTH = os.getenv("MOCK_AUTH", "False").lower() in ("true", "1", "yes")
print(f"Flask Server Initializing - MOCK_AUTH is: {MOCK_AUTH}", flush=True)

USERS_FILE = os.path.join(os.path.dirname(__file__), "users.json")
READINGS_FILE = os.path.join(os.path.dirname(__file__), "readings.json")

def load_mock_users():
    if not os.path.exists(USERS_FILE):
        return {}
    try:
        with open(USERS_FILE, 'r') as f:
            return json.load(f)
    except Exception:
        return {}

def save_mock_users(users):
    try:
        with open(USERS_FILE, 'w') as f:
            json.dump(users, f, indent=4)
    except Exception:
        pass

def load_mock_readings(reading_type, user_key):
    if not os.path.exists(READINGS_FILE):
        return {}
    try:
        with open(READINGS_FILE, 'r') as f:
            all_readings = json.load(f)
        return all_readings.get(reading_type, {}).get(user_key, {})
    except Exception:
        return {}

def save_mock_readings(reading_type, user_key, data):
    try:
        all_readings = {}
        if os.path.exists(READINGS_FILE):
            with open(READINGS_FILE, 'r') as f:
                all_readings = json.load(f)
        if reading_type not in all_readings:
            all_readings[reading_type] = {}
        all_readings[reading_type][user_key] = data
        with open(READINGS_FILE, 'w') as f:
            json.dump(all_readings, f, indent=4)
    except Exception:
        pass

# Initialize Supabase client
supabase: Client = None
if not MOCK_AUTH:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")

    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise ValueError("Supabase URL and Anon Key must be set in environment variables when MOCK_AUTH is disabled.")
    
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

# Helper to get a request-specific authenticated Supabase client for the logged-in user
def get_user_supabase_client():
    if MOCK_AUTH:
        return None
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    if 'user' in session and 'access_token' in session['user']:
        client.postgrest.auth(session['user']['access_token'])
    return client

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            flash("Please sign in to access this page.", "warning")
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Route to fetch readings (from either local JSON or Supabase table)
def get_readings_data(reading_type, user):
    if MOCK_AUTH:
        return load_mock_readings(reading_type, user['username'].lower())
    else:
        try:
            client = get_user_supabase_client()
            res = client.table("readings")\
                .select("data")\
                .eq("user_id", user['id'])\
                .eq("type", reading_type)\
                .execute()
            if res.data:
                return res.data[0]['data']
        except Exception as e:
            app.logger.error(f"Error loading readings from Supabase: {str(e)}")
        return {}

# Route to save readings (to either local JSON or Supabase table)
def set_readings_data(reading_type, user, data):
    if MOCK_AUTH:
        save_mock_readings(reading_type, user['username'].lower(), data)
        return True
    else:
        try:
            client = get_user_supabase_client()
            # Check if record already exists to update
            res = client.table("readings")\
                .select("id")\
                .eq("user_id", user['id'])\
                .eq("type", reading_type)\
                .execute()
            if res.data:
                record_id = res.data[0]['id']
                client.table("readings").update({
                    "data": data
                }).eq("id", record_id).execute()
            else:
                client.table("readings").insert({
                    "user_id": user['id'],
                    "type": reading_type,
                    "data": data
                }).execute()
            return True
        except Exception as e:
            app.logger.error(f"Error saving readings to Supabase: {str(e)}")
            return False

@app.route('/')
def index():
    if 'user' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password')
        
        if not username or not password:
            flash("Please enter both username and password.", "danger")
            return render_template('login.html', username=username)
            
        if MOCK_AUTH:
            users = load_mock_users()
            normalized = username.lower()
            if normalized in users and users[normalized] == password:
                session['user'] = {
                    'id': f"mock-uuid-{normalized}",
                    'email': f"{normalized}@local.portal",
                    'username': username,
                    'access_token': "mock-jwt-token"
                }
                flash("Welcome back (Developer Mode)!", "success")
                return redirect(url_for('dashboard'))
            else:
                flash("Invalid username or password.", "danger")
        else:
            try:
                # Map username to virtual email domain for Supabase
                email = f"{username.lower()}@local.portal"
                
                # Authenticate against Supabase
                response = supabase.auth.sign_in_with_password({
                    "email": email,
                    "password": password
                })
                
                # Store session in Flask secure cookies
                session['user'] = {
                    'id': response.user.id,
                    'email': response.user.email,
                    'username': username,
                    'access_token': response.session.access_token
                }
                flash("Welcome back!", "success")
                return redirect(url_for('dashboard'))
                
            except AuthApiError as e:
                msg = e.message
                if "Invalid login credentials" in msg:
                    msg = "Invalid username or password."
                flash(msg, "danger")
            except Exception as e:
                flash("An unexpected error occurred. Please try again.", "danger")
                app.logger.error(f"Login unexpected exception: {str(e)}")
            
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if 'user' in session:
        return redirect(url_for('dashboard'))
        
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        
        if not username or not password or not confirm_password:
            flash("Please fill in all the details.", "danger")
            return render_template('signup.html', username=username)
            
        if password != confirm_password:
            flash("Passwords do not match. Please try again.", "danger")
            return render_template('signup.html', username=username)
            
        if MOCK_AUTH:
            users = load_mock_users()
            normalized = username.lower()
            if normalized in users:
                flash("Username is already taken.", "danger")
            else:
                users[normalized] = password
                save_mock_users(users)
                session['user'] = {
                    'id': f"mock-uuid-{normalized}",
                    'email': f"{normalized}@local.portal",
                    'username': username,
                    'access_token': "mock-jwt-token"
                }
                flash("Sign up successful (Developer Mode)! You are now logged in.", "success")
                return redirect(url_for('dashboard'))
        else:
            try:
                # Map username to virtual email domain for Supabase
                email = f"{username.lower()}@local.portal"
                
                # Create user in Supabase
                response = supabase.auth.sign_up({
                    "email": email,
                    "password": password
                })
                
                if response.session:
                    session['user'] = {
                        'id': response.user.id,
                        'email': response.user.email,
                        'username': username,
                        'access_token': response.session.access_token
                    }
                    flash("Sign up successful! You are now logged in.", "success")
                    return redirect(url_for('dashboard'))
                else:
                    flash("Registration successful! You can now log in.", "info")
                    return redirect(url_for('login'))
                    
            except AuthApiError as e:
                flash(e.message, "danger")
            except Exception as e:
                flash("An unexpected error occurred during signup.", "danger")
                app.logger.error(f"Signup unexpected exception: {str(e)}")
            
    return render_template('signup.html')

# Core Dashboard (Daily / Monthly Navigation)
@app.route('/dashboard')
@login_required
def dashboard():
    user = session['user']
    return render_template('dashboard.html', user=user)

# Daily Dashboard (Readings / Checklists Navigation)
@app.route('/dashboard/daily')
@login_required
def daily():
    user = session['user']
    return render_template('daily.html', user=user)

# Readings Category Dashboard (Power / Water Selection)
@app.route('/dashboard/daily/readings')
@login_required
def readings():
    user = session['user']
    return render_template('readings.html', user=user)

# Power House 1 & 2 Table Form
@app.route('/dashboard/daily/readings/power', methods=['GET', 'POST'])
@login_required
def power_readings():
    user = session['user']
    if request.method == 'POST':
        # Collect form variables matching the Power House layout with individual PF fields
        fields = [
            'ph1_solar_75', 'ph1_solar_75_pf',
            'ph1_solar_33', 'ph1_solar_33_pf',
            'ph1_line_import', 'ph1_line_import_pf',
            'ph1_line_export', 'ph1_line_export_pf',
            'ph1_weld_import', 'ph1_weld_import_pf',
            'ph1_weld_export', 'ph1_weld_export_pf',
            'ph2_solar_90', 'ph2_solar_90_pf',
            'ph2_line_import', 'ph2_line_import_pf',
            'ph2_line_export', 'ph2_line_export_pf',
            'ph2_weld_import', 'ph2_weld_import_pf',
            'ph2_weld_export', 'ph2_weld_export_pf'
        ]
        data = {f: request.form.get(f, '').strip() for f in fields}
        if set_readings_data('power', user, data):
            flash("Power House readings saved successfully!", "success")
        else:
            flash("Failed to save readings to database.", "danger")
        return redirect(url_for('power_readings'))

    # Load existing values
    data = get_readings_data('power', user)
    return render_template('power.html', user=user, data=data)

# Water Valve 1-16 Table Form
@app.route('/dashboard/daily/readings/water', methods=['GET', 'POST'])
@login_required
def water_readings():
    user = session['user']
    if request.method == 'POST':
        # Collect 16 valve values
        data = {}
        for i in range(1, 17):
            field = f"valve_{i}"
            data[field] = request.form.get(field, '').strip()
        
        if set_readings_data('water', user, data):
            flash("Water valve readings saved successfully!", "success")
        else:
            flash("Failed to save readings to database.", "danger")
        return redirect(url_for('water_readings'))

    # Load existing values
    data = get_readings_data('water', user)
    return render_template('water.html', user=user, data=data)

# Export Power House readings to CSV/Excel
@app.route('/dashboard/daily/readings/power/export')
@login_required
def export_power():
    import csv
    import io
    from flask import Response
    
    user = session['user']
    data = get_readings_data('power', user)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write CSV Header
    writer.writerow(['Power House', 'Parameter', 'Value (kW)', 'Power Factor (PF)'])
    
    # Power House 1 rows
    writer.writerow(['Power House 1', 'Solar 75 KW', data.get('ph1_solar_75', ''), data.get('ph1_solar_75_pf', '')])
    writer.writerow(['Power House 1', 'Solar 33 KW', data.get('ph1_solar_33', ''), data.get('ph1_solar_33_pf', '')])
    writer.writerow(['Power House 1', 'Power Line IMPORT', data.get('ph1_line_import', ''), data.get('ph1_line_import_pf', '')])
    writer.writerow(['Power House 1', 'Power Line EXPORT', data.get('ph1_line_export', ''), data.get('ph1_line_export_pf', '')])
    writer.writerow(['Power House 1', 'Welding Line IMPORT', data.get('ph1_weld_import', ''), data.get('ph1_weld_import_pf', '')])
    writer.writerow(['Power House 1', 'Welding Line EXPORT', data.get('ph1_weld_export', ''), data.get('ph1_weld_export_pf', '')])
    
    # Power House 2 rows
    writer.writerow(['Power House 2', 'Solar 90 KW', data.get('ph2_solar_90', ''), data.get('ph2_solar_90_pf', '')])
    writer.writerow(['Power House 2', 'Power Line IMPORT', data.get('ph2_line_import', ''), data.get('ph2_line_import_pf', '')])
    writer.writerow(['Power House 2', 'Power Line EXPORT', data.get('ph2_line_export', ''), data.get('ph2_line_export_pf', '')])
    writer.writerow(['Power House 2', 'Welding Line IMPORT', data.get('ph2_weld_import', ''), data.get('ph2_weld_import_pf', '')])
    writer.writerow(['Power House 2', 'Welding Line EXPORT', data.get('ph2_weld_export', ''), data.get('ph2_weld_export_pf', '')])
    
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=power_readings.csv"}
    )

# Export Water Valve readings to CSV/Excel
@app.route('/dashboard/daily/readings/water/export')
@login_required
def export_water():
    import csv
    import io
    from flask import Response
    
    user = session['user']
    data = get_readings_data('water', user)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Write CSV Header
    writer.writerow(['Valve Name', 'Flow Reading (m³/h)'])
    
    # Valves 1 to 16
    for i in range(1, 17):
        writer.writerow([f"VALVE {i}", data.get(f"valve_{i}", '')])
        
    output.seek(0)
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-disposition": "attachment; filename=water_readings.csv"}
    )

@app.route('/logout')
def logout():
    session.pop('user', None)
    if not MOCK_AUTH and supabase:
        try:
            supabase.auth.sign_out()
        except Exception:
            pass
    flash("You have logged out successfully.", "info")
    return redirect(url_for('login'))

# Production deploy trigger comment
if __name__ == '__main__':
    app.run(debug=True, port=5000, host='0.0.0.0')

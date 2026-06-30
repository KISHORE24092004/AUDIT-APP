import os
import openpyxl
from copy import copy
from openpyxl.utils import get_column_letter

def generate_template_for_genset(genset_id, capacity_str):
    src_path = os.path.join(os.path.dirname(__file__), "power_readings.xlsx")
    dst_name = f"genset{genset_id}_readings.xlsx"
    dst_path = os.path.join(os.path.dirname(__file__), dst_name)
    
    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source power template not found at {src_path}")
        
    wb = openpyxl.load_workbook(src_path)
    ws = wb.active # 'power_readings'
    ws.title = f"genset{genset_id}_readings"
    
    # Save the original style of cell K1 (Doc Info) before unmerging
    k1_cell = ws.cell(row=1, column=11)
    k1_font = copy(k1_cell.font)
    k1_border = copy(k1_cell.border)
    k1_fill = copy(k1_cell.fill)
    k1_alignment = copy(k1_cell.alignment)
    k1_number_format = k1_cell.number_format

    # 1. Unmerge all existing merged cells
    merged_ranges = list(ws.merged_cells.ranges)
    for r in merged_ranges:
        ws.unmerge_cells(str(r))
        
    # 2. Delete rows 36 onwards
    ws.delete_rows(36, 35)
    
    # 3. Discard the second image
    if hasattr(ws, '_images'):
        ws._images = [img for img in ws._images if getattr(img.anchor._from, 'row', 0) < 35]
    
    # 4. Copy cell styles from column B (2) to columns N to W (columns 14 to 23)
    # for all rows (1 to 35)
    for r in range(1, 36):
        source_cell = ws.cell(row=r, column=2)
        for col_idx in range(14, 24):
            target_cell = ws.cell(row=r, column=col_idx)
            if source_cell.has_style:
                target_cell.font = copy(source_cell.font)
                target_cell.border = copy(source_cell.border)
                target_cell.fill = copy(source_cell.fill)
                target_cell.alignment = copy(source_cell.alignment)
                target_cell.number_format = source_cell.number_format
                
    # 5. Set column widths for new columns N to W to match column B
    width_b = ws.column_dimensions['B'].width if ws.column_dimensions['B'].width else 12
    for col_idx in range(14, 24):
        col_letter = get_column_letter(col_idx)
        ws.column_dimensions[col_letter].width = width_b
        
    # 6. Write new header values
    ws.cell(row=1, column=1, value="               BARANI HYDRAULICS INDIA PRIVATE LIMITED")
    
    # Set Doc Info cell at V1 with the copied K1 style and wrap_text=True
    v1_cell = ws.cell(row=1, column=22, value=f"DOC NO: R/MAI/GS{genset_id}\nMONTH/YEAR: ") # Column V (22)
    v1_cell.font = k1_font
    v1_cell.border = k1_border
    v1_cell.fill = k1_fill
    from openpyxl.styles import Alignment
    v1_cell.alignment = Alignment(
        horizontal=k1_alignment.horizontal if k1_alignment else 'left',
        vertical=k1_alignment.vertical if k1_alignment else 'center',
        wrap_text=True
    )
    v1_cell.number_format = k1_number_format

    # Subheader (Row 2 and Row 19)
    ws.cell(row=2, column=2, value=f"GENSET-{genset_id} ({capacity_str}) DAILY CHECKLIST")
    ws.cell(row=19, column=2, value=f"GENSET-{genset_id} ({capacity_str}) DAILY CHECKLIST")
    
    # Column headers (Row 3 and Row 20)
    ws.cell(row=3, column=1, value="S.NO")
    ws.cell(row=20, column=1, value="S.NO")
    
    # Generate headers list (22 checks)
    headers = [f"Q{i}" for i in range(1, 23)]
        
    for idx, header in enumerate(headers):
        col_idx = idx + 2 # Start from Column B (2)
        ws.cell(row=3, column=col_idx, value=header)
        ws.cell(row=20, column=col_idx, value=header)
        
    # 7. Re-merge ranges
    new_merges = [
        "A1:U1", "V1:W1",
        "B2:W2", "B19:W19"
    ]
    for r in new_merges:
        ws.merge_cells(r)
        
    # 8. Clear data cells in rows 4-18 and 21-35 for columns B to W (2 to 23)
    for r in range(4, 19):
        for c in range(2, 24):
            ws.cell(row=r, column=c).value = None
    for r in range(21, 36):
        for c in range(2, 24):
            ws.cell(row=r, column=c).value = None
            
    wb.save(dst_path)
    print(f"Successfully generated {dst_name} template!")

if __name__ == "__main__":
    generate_template_for_genset(1, "125kW")
    generate_template_for_genset(2, "160kW")
    
    # Remove old combined template if it exists
    if os.path.exists("genset_readings.xlsx"):
        try:
            os.remove("genset_readings.xlsx")
        except Exception:
            pass

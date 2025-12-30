#!/bin/bash

# Process template images script
# Compresses and renames images from source folder to public/arch/templates/

set -e

SOURCE_DIR="/Users/demon/MKsaas/nano/图片"
TARGET_DIR="/Users/demon/MKsaas/nano/public/arch/templates"

# UUID pattern regex
UUID_PATTERN='[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

# Function to check if filename is a UUID or unnamed
is_input() {
    local filename=$(basename "$1")
    if [[ $filename =~ $UUID_PATTERN ]] || [[ "$filename" == unnamed* ]]; then
        return 0
    fi
    return 1
}

# Function to compress image to target size
compress_image() {
    local input="$1"
    local output="$2"
    local max_size=307200  # 300KB in bytes

    local ext="${input##*.}"
    ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

    # Copy to output first
    cp "$input" "$output"

    # Get current size
    local current_size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null)

    if [[ $current_size -le $max_size ]]; then
        echo "    Already under 300KB: $(( current_size / 1024 ))KB"
        return 0
    fi

    echo "    Original size: $(( current_size / 1024 ))KB"

    if [[ $ext == "png" ]]; then
        # Use pngquant for PNG compression
        pngquant --quality=50-80 --speed 1 --force --output "$output" "$output" 2>/dev/null || true
    elif [[ $ext == "jpg" || $ext == "jpeg" ]]; then
        # Use jpegoptim for JPEG compression
        jpegoptim --max=70 --strip-all "$output" 2>/dev/null || true
    fi

    # Check size again
    current_size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null)

    # If still too large, try more aggressive compression
    if [[ $current_size -gt $max_size ]]; then
        if [[ $ext == "png" ]]; then
            pngquant --quality=30-60 --speed 1 --force --output "$output" "$output" 2>/dev/null || true
        elif [[ $ext == "jpg" || $ext == "jpeg" ]]; then
            jpegoptim --max=50 --strip-all "$output" 2>/dev/null || true
        fi
        current_size=$(stat -f%z "$output" 2>/dev/null || stat -c%s "$output" 2>/dev/null)
    fi

    echo "    Compressed to: $(( current_size / 1024 ))KB"
}

# Process a single folder
process_folder() {
    local folder_path="$1"
    local template_id="$2"

    echo ""
    echo "========================================"
    echo "Processing: $(basename "$folder_path") -> $template_id"
    echo "========================================"

    if [[ ! -d "$folder_path" ]]; then
        echo "  WARNING: Folder not found: $folder_path"
        return
    fi

    local input_files=()
    local output_files=()

    # Find all image files in folder
    shopt -s nullglob
    for file in "$folder_path"/*.png "$folder_path"/*.jpg "$folder_path"/*.jpeg "$folder_path"/*.PNG "$folder_path"/*.JPG "$folder_path"/*.JPEG; do
        [[ -f "$file" ]] || continue
        if is_input "$file"; then
            input_files+=("$file")
        else
            output_files+=("$file")
        fi
    done
    shopt -u nullglob

    echo "  Found ${#input_files[@]} input file(s), ${#output_files[@]} output file(s)"

    # Process input files
    local input_index=1
    for input_file in "${input_files[@]}"; do
        local ext="${input_file##*.}"
        ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')

        local target_name
        if [[ ${#input_files[@]} -eq 1 ]]; then
            target_name="${template_id}-input.${ext}"
        else
            target_name="${template_id}-input-${input_index}.${ext}"
        fi

        echo "  Processing input: $(basename "$input_file" | cut -c1-40)... -> $target_name"
        compress_image "$input_file" "$TARGET_DIR/$target_name"
        ((input_index++))
    done

    # Process output file (should be only one)
    if [[ ${#output_files[@]} -gt 0 ]]; then
        local output_file="${output_files[0]}"
        local ext="${output_file##*.}"
        ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
        local target_name="${template_id}-output.${ext}"

        echo "  Processing output -> $target_name"
        compress_image "$output_file" "$TARGET_DIR/$target_name"
    fi
}

# Main execution
echo "Starting image processing..."
echo "Source: $SOURCE_DIR"
echo "Target: $TARGET_DIR"
echo ""

# Create target directory if needed
mkdir -p "$TARGET_DIR"

# Process folders with explicit mappings
process_folder "$SOURCE_DIR/白模转效果图" "white-model-render"
process_folder "$SOURCE_DIR/体块转效果图" "block-model-render"
process_folder "$SOURCE_DIR/模型转效果图" "rhino-to-render"
process_folder "$SOURCE_DIR/卫星图生成方案" "satellite-to-render"
process_folder "$SOURCE_DIR/根据总图生成鸟瞰效果" "masterplan-aerial"
process_folder "$SOURCE_DIR/彩色总平面填色" "masterplan-color"
process_folder "$SOURCE_DIR/平面图填色" "floorplan-color"
process_folder "$SOURCE_DIR/概念图生成" "sasaki-analysis"
process_folder "$SOURCE_DIR/生成图底关系" "site-analysis-texture"
process_folder "$SOURCE_DIR/材质替换" "material-replace"
process_folder "$SOURCE_DIR/设计细部大样" "section-diagram"
process_folder "$SOURCE_DIR/多参考生成" "multi-reference-render"
process_folder "$SOURCE_DIR/大场景转局部" "aerial-to-street"
process_folder "$SOURCE_DIR/实景照片生成方案" "redline-landscape"
process_folder "$SOURCE_DIR/室内标注设计" "interior-annotate"
process_folder "$SOURCE_DIR/建筑迁移" "building-migration"
process_folder "$SOURCE_DIR/杂乱室内客厅设计" "interior-renovation"
process_folder "$SOURCE_DIR/架空层实景设计" "ground-floor-design"
process_folder "$SOURCE_DIR/根据红线生成方案" "redline-to-design"
process_folder "$SOURCE_DIR/白天转夜景" "day-to-night"

echo ""
echo "========================================"
echo "Processing complete!"
echo "========================================"
echo "New files in target directory:"
ls -la "$TARGET_DIR" | grep -E "(multi-reference|aerial-to-street|redline|interior-annotate|building-migration|interior-renovation|ground-floor|day-to-night|white-model|block-model|rhino|satellite|masterplan-aerial|masterplan-color|floorplan|sasaki|site-analysis|material-replace|section-diagram)" || echo "No matching files found"

import os
import argparse
import shutil
import re
import sys

def process_directory(target_dir, dest_root):
    # 1. Validation & Discovery
    if not os.path.exists(target_dir):
        print(f"Error: Target directory '{target_dir}' does not exist.")
        return

    files = os.listdir(target_dir)
    md_files = [f for f in files if f.endswith('.md')]
    static_dir = os.path.join(target_dir, 'static')
    
    if len(md_files) != 1:
        print(f"Error: Expected exactly one markdown file in '{target_dir}', found {len(md_files)}: {md_files}")
        return

    md_filename = md_files[0]
    md_path = os.path.join(target_dir, md_filename)
    has_static = os.path.isdir(static_dir)

    # 2. Extract Title & Content Processing
    title = None
    new_content_lines = []
    
    with open(md_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    for line in lines:
        # Extract Title (H1) - Only the first one
        if title is None and line.startswith('# '):
            title = line[2:].strip()
            continue # Remove the H1 line
        
        # Replace Callout
        if '> [!TIP]' in line:
            line = line.replace('> [!TIP]', '> 💡 **重要**')
            
        # Replace Image Syntax
        # ![alt](static/filename.png) -> {% asset_img "filename.png" "alt" %}
        # Regex to capture alt text and filename. 
        # Assumes format matches exactly "static/" prefix as per requirement.
        def image_replacer(match):
            alt_text = match.group(1)
            image_path = match.group(2)
            if image_path.startswith('static/'):
                filename = os.path.basename(image_path)
                return f'{{% asset_img "{filename}" "{alt_text}" %}}'
            return match.group(0) # No change if not in static/
            
        line = re.sub(r'!\[(.*?)\]\((.*?)\)', image_replacer, line)
        
        new_content_lines.append(line)

    if not title:
        print(f"Error: No H1 title found in {md_filename}")
        return

    # Sanitize title for filesystem (keep spaces as requested, just remove reckless chars)
    # Using a simple blocklist for standard filesystem safety
    fs_safe_title = re.sub(r'[\\/*?:"<>|]', "", title) 
    
    # 3. Prepare Destination
    
    # Asset Folder: <dest>/<Title>
    asset_folder_path = os.path.join(dest_root, fs_safe_title)
    
    # Markdown File: <dest>/<Title>.md
    dest_md_path = os.path.join(dest_root, f"{fs_safe_title}.md")

    # Ensure dest_root exists
    if not os.path.exists(dest_root):
        os.makedirs(dest_root)

    if os.path.exists(asset_folder_path):
        print(f"Warning: Asset folder '{asset_folder_path}' already exists, merging...")
    else:
        # Only create asset folder if we actually have assets or want to enforce the structure
        if has_static:
           os.makedirs(asset_folder_path)

    # 4. Move Assets
    if has_static:
        if not os.path.exists(asset_folder_path):
             os.makedirs(asset_folder_path)
             
        for item in os.listdir(static_dir):
            s = os.path.join(static_dir, item)
            d = os.path.join(asset_folder_path, item)
            if os.path.isfile(s):
                shutil.copy2(s, d)

    # 5. Write New Markdown
    
    with open(dest_md_path, 'w', encoding='utf-8') as f:
        # Front Matter
        f.write('---\n')
        f.write(f'title: {title}\n')
        f.write('---\n\n')
        
        # Content
        f.writelines(new_content_lines)

    print(f"Successfully processed '{title}'")
    print(f"  -> Created Markdown: {dest_md_path}")
    if has_static:
        print(f"  -> Assets moved to: {asset_folder_path}")

def main():
    parser = argparse.ArgumentParser(description='Refactor Markdown for Hexo.')
    parser.add_argument('target_dir', help='The directory containing the converted markdown and static folder')
    parser.add_argument('--dest', required=True, help='Destination directory (e.g., location of source/_posts)')

    args = parser.parse_args()
    
    process_directory(args.target_dir, args.dest)

if __name__ == '__main__':
    main()

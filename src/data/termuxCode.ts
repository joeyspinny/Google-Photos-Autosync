export const termuxPythonScript = `#!/usr/bin/env python3
"""
Sync Google Photos Favorites to Google Drive with 100% EXIF & Filename Preservation.
Runs locally on Android inside Termux.

Requirements:
- Python 3.10+
- Termux with 'termux-setup-storage' executed
- Packages: google-api-python-client, google-auth-oauthlib, google-auth-httplib2
"""

import os
import sys
import subprocess
import re
import mimetypes
from pathlib import Path
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

# OAuth Scopes required for Drive folder & file creation
SCOPES = ['https://www.googleapis.com/auth/drive.file']
FOLDER_NAME = "High-Res Favorites"
CREDENTIALS_FILE = "client_secret.json"
TOKEN_FILE = "token.json"

def authenticate_google_drive():
    """Authenticates via OAuth 2.0 and returns the Google Drive v3 client service."""
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("[*] Refreshing expired Google Drive credentials...")
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                print(f"[!] Error: '{CREDENTIALS_FILE}' not found in current directory.")
                print("[!] Please place your Google Cloud OAuth Client ID JSON file here.")
                print("[!] See setup instructions in the dashboard.")
                sys.exit(1)

            print("[*] Starting local OAuth authorization flow...")
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            
            # Use local server flow (Termux will automatically open local port or provide link)
            creds = flow.run_local_server(
                port=8080,
                open_browser=True,
                prompt="consent"
            )

        with open(TOKEN_FILE, 'w') as token:
            token.write(creds.to_json())
            print("[✓] Saved fresh credentials to token.json")

    return build('drive', 'v3', credentials=creds)

def query_mediastore_favorites():
    """
    Executes Android's native 'content query' CLI to retrieve photos where is_favorite=1.
    Grabs true display name, relative path, date taken, and direct file path (_data).
    """
    print("[*] Querying Android MediaStore for photos marked IS_FAVORITE == 1...")
    cmd = [
        "content", "query",
        "--uri", "content://media/external/images/media",
        "--projection", "_id:_display_name:relative_path:date_taken:mime_type:_size:_data",
        "--where", "is_favorite=1",
        "--sort", "date_taken DESC"
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except FileNotFoundError:
        print("[!] Error: 'content' command not found. Are you running inside Android/Termux?")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"[!] Error querying MediaStore: {e.stderr}")
        sys.exit(1)

    photos = []
    # Output format is:
    # Row: 0 _id=1024, _display_name=PXL_20241015_142010.jpg, relative_path=DCIM/Camera/, date_taken=1728998410000, mime_type=image/jpeg, _size=4512980, _data=/storage/emulated/0/DCIM/Camera/PXL_20241015_142010.jpg
    row_pattern = re.compile(
        r"_id=(\d+).*?_display_name=([^,]+).*?(?:relative_path=([^,]+))?.*?date_taken=(\d+).*?mime_type=([^,]+).*?_size=(\d+).*?_data=([^,\n]+)",
        re.DOTALL
    )

    for line in result.stdout.split("Row: "):
        line = line.strip()
        if not line:
            continue
        
        # Parse fields with key-value parser for reliability
        fields = {}
        for part in re.split(r",\s*(?=[a-zA-Z_]+=)", line):
            if "=" in part:
                k, v = part.split("=", 1)
                fields[k.strip()] = v.strip()

        if "_display_name" in fields and ("_data" in fields or "_id" in fields):
            file_path = fields.get("_data", "")
            # Fallback path if _data wasn't populated in scoped storage
            if not file_path or not os.path.exists(file_path):
                rel_path = fields.get("relative_path", "DCIM/Camera/")
                alt_path = os.path.join("/storage/emulated/0", rel_path, fields["_display_name"])
                if os.path.exists(alt_path):
                    file_path = alt_path

            photos.append({
                "id": fields.get("_id"),
                "display_name": fields.get("_display_name"),
                "relative_path": fields.get("relative_path", "DCIM/Camera/"),
                "date_taken": fields.get("date_taken", "0"),
                "mime_type": fields.get("mime_type", "image/jpeg"),
                "size": int(fields.get("_size", 0)),
                "file_path": file_path
            })

    print(f"[✓] Found {len(photos)} favorite photos in MediaStore.")
    return photos

def get_or_create_drive_folder(drive_service, folder_name=FOLDER_NAME):
    """Checks if 'High-Res Favorites' exists in Google Drive; creates it if missing."""
    print(f"[*] Checking for Google Drive folder '{folder_name}'...")
    query = f"name = '{folder_name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
    response = drive_service.files().list(
        q=query,
        spaces='drive',
        fields='files(id, name)'
    ).execute()

    files = response.get('files', [])
    if files:
        folder_id = files[0]['id']
        print(f"[✓] Found existing folder: '{folder_name}' (ID: {folder_id})")
        return folder_id

    # Create folder
    print(f"[*] Folder not found. Creating '{folder_name}'...")
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    folder = drive_service.files().create(body=file_metadata, fields='id').execute()
    folder_id = folder.get('id')
    print(f"[✓] Created folder: '{folder_name}' (ID: {folder_id})")
    return folder_id

def get_existing_filenames_in_drive(drive_service, folder_id):
    """Retrieves all existing filenames in target folder to prevent redundant re-uploads."""
    query = f"'{folder_id}' in parents and trashed = false"
    existing = set()
    page_token = None
    while True:
        response = drive_service.files().list(
            q=query,
            spaces='drive',
            fields='nextPageToken, files(name)',
            pageToken=page_token
        ).execute()
        for f in response.get('files', []):
            existing.add(f['name'])
        page_token = response.get('nextPageToken')
        if not page_token:
            break
    return existing

def sync_favorites():
    """Main execution routine."""
    print("=" * 60)
    print("  MediaStore RAW Favorites -> Google Drive Sync")
    print("  100% EXIF & Original Filename Preservation")
    print("=" * 60)

    # 1. Authenticate with Google Drive API v3
    service = authenticate_google_drive()

    # 2. Get target folder ID
    folder_id = get_or_create_drive_folder(service)

    # 3. Query phone database for IS_FAVORITE == 1
    favorites = query_mediastore_favorites()
    if not favorites:
        print("[!] No photos found marked as favorite. Mark photos with a heart in Google Photos first.")
        return

    # 4. Check already synced files in folder
    existing_files = get_existing_filenames_in_drive(service, folder_id)
    print(f"[*] Detected {len(existing_files)} existing items in '{FOLDER_NAME}' on Drive.")

    # 5. Raw binary upload loop
    uploaded_count = 0
    skipped_count = 0

    for idx, photo in enumerate(favorites, 1):
        name = photo["display_name"]
        path = photo["file_path"]
        mime = photo["mime_type"] or "image/jpeg"
        size_mb = photo["size"] / (1024 * 1024)

        if name in existing_files:
            print(f"[{idx}/{len(favorites)}] ⏩ Skipping already synced: {name}")
            skipped_count += 1
            continue

        if not path or not os.path.exists(path):
            print(f"[{idx}/{len(favorites)}] ⚠️  Could not find file on disk: {name} (path: {path})")
            continue

        print(f"[{idx}/{len(favorites)}] ⬆️  Uploading RAW stream: {name} ({size_mb:.2f} MB)...")

        file_metadata = {
            'name': name,
            'parents': [folder_id],
            'description': f"Direct binary sync from MediaStore. Source path: {photo['relative_path']}"
        }

        # MediaFileUpload reads raw bytes directly from disk in chunks (resumable=True)
        # Guarantees all EXIF tags (GPS, camera model, date taken) are preserved exactly!
        media = MediaFileUpload(
            path,
            mimetype=mime,
            resumable=True,
            chunksize=1024 * 1024 * 5 # 5MB chunk
        )

        try:
            uploaded_file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id, name, size'
            ).execute()
            print(f"    ✓ Uploaded! Drive ID: {uploaded_file.get('id')}")
            uploaded_count += 1
        except Exception as e:
            print(f"    ✗ Failed to upload {name}: {e}")

    print("=" * 60)
    print(f"[✓] Sync complete! Uploaded: {uploaded_count}, Skipped: {skipped_count}, Total: {len(favorites)}")
    print(f"[✓] Check your Google Drive folder '{FOLDER_NAME}' to verify.")

if __name__ == '__main__':
    sync_favorites()
`;

export const termuxSetupScript = `#!/data/data/com.termux/files/usr/bin/bash
# One-tap installation script for Termux on Android
# Prepares Python, Termux storage permissions, and Google Drive dependencies

set -e

echo "=== Setting up MediaStore Drive Sync in Termux ==="

# 1. Request Android storage permissions
echo "[1/4] Granting storage access..."
termux-setup-storage

# 2. Update packages and install python
echo "[2/4] Installing Python and build dependencies..."
pkg update -y
pkg install -y python python-pip termux-api

# 3. Install Google API client libraries
echo "[3/4] Installing Google Drive API client..."
pip install --upgrade pip
pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib

# 4. Check client_secret.json
echo "[4/4] Checking credentials..."
if [ ! -f "client_secret.json" ]; then
    echo "⚠️ NOTE: Please place your 'client_secret.json' (from Google Cloud Console) in this directory!"
    echo "Then run:"
    echo "   python sync_favorites_drive.py"
else
    echo "✓ client_secret.json detected!"
    echo "To run the sync, simply execute:"
    echo "   python sync_favorites_drive.py"
fi

echo "=== Termux environment is ready! ==="
`;

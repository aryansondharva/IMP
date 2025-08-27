#!/usr/bin/env python3
"""
Installation script for NEXUS - Conversational Data Analysis Agent
Run this script to install all required dependencies.
"""

import subprocess
import sys

def install_package(package):
    """Install a package using pip."""
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package])
        print(f"✓ Successfully installed {package}")
        return True
    except subprocess.CalledProcessError:
        print(f"✗ Failed to install {package}")
        return False

def main():
    """Install all required packages."""
    print("🚀 Installing dependencies for NEXUS - Conversational Data Analysis Agent")
    print("=" * 70)
    
    # Core packages
    packages = [
        "fastapi",
        "uvicorn[standard]",
        "python-dotenv",
        "requests",
        "jinja2",
        "assemblyai",
        "google-generativeai",
        "websockets",
        "pandas",
        "pdfplumber",
        "python-multipart",
        "openpyxl",
        "xlrd",
        "murf"
    ]
    
    failed_packages = []
    
    for package in packages:
        print(f"\n📦 Installing {package}...")
        if not install_package(package):
            failed_packages.append(package)
    
    print("\n" + "=" * 70)
    if failed_packages:
        print("⚠️  Some packages failed to install:")
        for pkg in failed_packages:
            print(f"   - {pkg}")
        print("\nYou can try installing them manually:")
        print(f"pip install {' '.join(failed_packages)}")
    else:
        print("🎉 All dependencies installed successfully!")
        print("\nNext steps:")
        print("1. Create a .env file with your API keys")
        print("2. Run: uvicorn main:app --reload")
        print("3. Visit http://localhost:8000")

if __name__ == "__main__":
    main()

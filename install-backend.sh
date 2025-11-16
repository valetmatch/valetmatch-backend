#!/bin/bash
echo "🚀 Installing Valeter Portal Backend Files..."
cd ~/Desktop/valetmatch/backend

# Backup server.js
if [ -f "server.js" ]; then
    cp server.js server-backup.js
    echo "✓ Backed up server.js"
fi

# Copy files from Downloads (handling renamed versions)
for file in server.js valeter-auth-routes.js valeter-routes.js payment-approval-routes.js; do
    if [ -f ~/Downloads/$file ]; then
        cp ~/Downloads/$file .
        echo "✓ Copied $file"
    elif [ -f ~/Downloads/"${file%.*} (1).${file##*.}" ]; then
        cp ~/Downloads/"${file%.*} (1).${file##*.}" $file
        echo "✓ Copied $file (renamed)"
    else
        echo "✗ Could not find $file"
    fi
done

echo ""
echo "✅ Installation complete!"
ls -la *.js | grep valeter

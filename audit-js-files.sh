#!/bin/bash

echo "=================================================="
echo "JavaScript Files Audit"
echo "=================================================="
echo ""

# 1. Find type="module" in views
echo "1. Scanning for type=\"module\" in views..."
grep -r 'type="module"' views/ --include="*.ejs" --include="*.html" 2>/dev/null | \
  grep -oP 'src="[^"]+\.js"' | \
  sed 's/src="//; s/"//; s|^/||' | \
  sed "s|static/<%= NODE_ENV === 'production' ? 'min.js' : 'js' %>|js|g" | \
  sed 's|static/min.js/||g' | \
  sed 's|static/js/||g' | \
  sed 's|static/||g' | \
  sort -u > /tmp/found-modules.txt

MODULE_COUNT=$(wc -l < /tmp/found-modules.txt)
echo "   Found: $MODULE_COUNT module files"

# 2. Find ALL scripts in views
echo ""
echo "2. Scanning for ALL <script src=...> in views..."
grep -r '<script' views/ --include="*.ejs" --include="*.html" 2>/dev/null | \
  grep -oP 'src="[^"]+\.js"' | \
  sed 's/src="//; s/"//; s|^/||' | \
  sed "s|static/<%= NODE_ENV === 'production' ? 'min.js' : 'js' %>|js|g" | \
  sed 's|static/min.js/||g' | \
  sed 's|static/js/||g' | \
  sed 's|static/||g' | \
  sort -u > /tmp/found-all-scripts.txt

SCRIPT_COUNT=$(wc -l < /tmp/found-all-scripts.txt)
echo "   Found: $SCRIPT_COUNT total script files"

# 3. Extract from deploy.sh
echo ""
echo "3. Extracting files from deploy.sh..."
grep -oP '"public/js/[^"]+\.js"' deploy.sh 2>/dev/null | \
  sed 's/"//g; s|^public/||' | \
  sort -u > /tmp/deploy-files.txt

DEPLOY_COUNT=$(wc -l < /tmp/deploy-files.txt)
echo "   Found: $DEPLOY_COUNT files in deploy.sh"

# 4. Find ALL .js files in project
echo ""
echo "4. Finding ALL .js files in public/js/..."
find public/js -type f -name "*.js" 2>/dev/null | \
  sed 's|^public/||' | \
  sort > /tmp/all-js-files.txt

ALL_COUNT=$(wc -l < /tmp/all-js-files.txt)
echo "   Found: $ALL_COUNT .js files total"

# 5. Analysis
echo ""
echo "=================================================="
echo "ANALYSIS"
echo "=================================================="

echo ""
echo "MISSING FROM DEPLOY.SH (used in views but not deployed):"
MISSING=$(comm -23 /tmp/found-all-scripts.txt /tmp/deploy-files.txt)
if [ -z "$MISSING" ]; then
    echo "   OK - all view scripts are in deploy.sh"
else
    echo "$MISSING" | sed 's/^/   MISSING: /'
    MISSING_COUNT=$(echo "$MISSING" | wc -l)
    echo ""
    echo "   Total: $MISSING_COUNT files need to be added"
fi

echo ""
echo "IN DEPLOY.SH BUT NOT IN VIEWS (imported modules):"
EXTRA=$(comm -13 /tmp/found-all-scripts.txt /tmp/deploy-files.txt)
if [ -z "$EXTRA" ]; then
    echo "   (None)"
else
    EXTRA_COUNT=$(echo "$EXTRA" | wc -l)
    echo "   Total: $EXTRA_COUNT files"
    echo "$EXTRA" | head -5 | sed 's/^/   /'
    if [ $EXTRA_COUNT -gt 5 ]; then
        echo "   ... and $((EXTRA_COUNT - 5)) more"
    fi
fi

echo ""
echo "UNUSED FILES (in project but not in deploy.sh):"
UNUSED=$(comm -23 /tmp/all-js-files.txt /tmp/deploy-files.txt)
if [ -z "$UNUSED" ]; then
    echo "   OK - all files are deployed"
else
    UNUSED_COUNT=$(echo "$UNUSED" | wc -l)
    echo "   Total: $UNUSED_COUNT files"
    echo "$UNUSED" | head -5 | sed 's/^/   /'
    if [ $UNUSED_COUNT -gt 5 ]; then
        echo "   ... and $((UNUSED_COUNT - 5)) more"
    fi
fi

echo ""
echo "=================================================="
echo "SUMMARY"
echo "=================================================="
echo "Total .js files in project:     $ALL_COUNT"
echo "Files in deploy.sh:             $DEPLOY_COUNT"
echo "Scripts referenced in views:    $SCRIPT_COUNT"
echo "Type=module scripts:            $MODULE_COUNT"

if [ $ALL_COUNT -gt 0 ]; then
    COVERAGE=$(awk "BEGIN {printf \"%.1f\", ($DEPLOY_COUNT/$ALL_COUNT)*100}")
    echo "Coverage:                       ${COVERAGE}%"
fi

echo ""

if [ -n "$MISSING" ]; then
    echo "ACTION REQUIRED: Add missing files to deploy.sh"
    echo ""
    echo "FORMATTED FOR DEPLOY.SH (copy-paste ready):"
    echo "$MISSING" | awk '{print "    \"public/" $0 "\","}'
fi

echo ""
echo "Detailed reports saved to /tmp/"

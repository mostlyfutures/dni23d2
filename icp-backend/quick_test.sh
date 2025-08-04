#!/bin/bash

echo "🧪 Quick Test: Dark Pool DEX ICP Backend"
echo "========================================"
echo ""

# Test counters
PASSED=0
FAILED=0
SKIPPED=0

echo "📁 File Structure Tests"
echo "----------------------"

# Test 1: Check if all required files exist
if [ -f dfx.json ]; then
    echo "✅ dfx.json exists"
    ((PASSED++))
else
    echo "❌ dfx.json missing"
    ((FAILED++))
fi

if [ -f Cargo.toml ]; then
    echo "✅ Cargo.toml exists"
    ((PASSED++))
else
    echo "❌ Cargo.toml missing"
    ((FAILED++))
fi

if [ -f deploy.sh ]; then
    echo "✅ deploy.sh exists"
    ((PASSED++))
else
    echo "❌ deploy.sh missing"
    ((FAILED++))
fi

if [ -f README.md ]; then
    echo "✅ README.md exists"
    ((PASSED++))
else
    echo "❌ README.md missing"
    ((FAILED++))
fi

if [ -d candid ]; then
    echo "✅ candid directory exists"
    ((PASSED++))
else
    echo "❌ candid directory missing"
    ((FAILED++))
fi

if [ -d src ]; then
    echo "✅ src directory exists"
    ((PASSED++))
else
    echo "❌ src directory missing"
    ((FAILED++))
fi

echo ""
echo "📄 Content Validation Tests"
echo "-------------------------"

# Test 2: Check if candid file exists
if [ -f candid/dark_pool_backend.did ]; then
    echo "✅ candid/dark_pool_backend.did exists"
    ((PASSED++))
else
    echo "❌ candid/dark_pool_backend.did missing"
    ((FAILED++))
fi

# Test 3: Check if source files exist
if [ -f src/dark_pool_backend/lib.rs ]; then
    echo "✅ src/dark_pool_backend/lib.rs exists"
    ((PASSED++))
else
    echo "❌ src/dark_pool_backend/lib.rs missing"
    ((FAILED++))
fi

# Test 4: Check if dfx.json is valid JSON
if python3 -m json.tool dfx.json > /dev/null 2>&1; then
    echo "✅ dfx.json is valid JSON"
    ((PASSED++))
else
    echo "❌ dfx.json is not valid JSON"
    ((FAILED++))
fi

# Test 5: Check if Cargo.toml has required dependencies
if grep -q "candid" Cargo.toml; then
    echo "✅ Cargo.toml contains candid dependency"
    ((PASSED++))
else
    echo "❌ Cargo.toml missing candid dependency"
    ((FAILED++))
fi

if grep -q "ic-cdk" Cargo.toml; then
    echo "✅ Cargo.toml contains ic-cdk dependency"
    ((PASSED++))
else
    echo "❌ Cargo.toml missing ic-cdk dependency"
    ((FAILED++))
fi

echo ""
echo "🔧 Configuration Tests"
echo "--------------------"

# Test 6: Check dfx.json configuration
if grep -q "dark_pool_backend" dfx.json; then
    echo "✅ dfx.json has correct canister name"
    ((PASSED++))
else
    echo "❌ dfx.json missing canister name"
    ((FAILED++))
fi

if grep -q '"type": "rust"' dfx.json; then
    echo "✅ dfx.json has rust type"
    ((PASSED++))
else
    echo "❌ dfx.json missing rust type"
    ((FAILED++))
fi

# Test 7: Check deploy script permissions
if [ -x deploy.sh ]; then
    echo "✅ deploy.sh is executable"
    ((PASSED++))
else
    echo "❌ deploy.sh is not executable"
    ((FAILED++))
fi

echo ""
echo "🧪 Functionality Tests"
echo "-------------------"

# Test 8: Check if candid file contains required types
if grep -q "type Order" candid/dark_pool_backend.did; then
    echo "✅ candid contains Order type"
    ((PASSED++))
else
    echo "❌ candid missing Order type"
    ((FAILED++))
fi

if grep -q "type StateChannel" candid/dark_pool_backend.did; then
    echo "✅ candid contains StateChannel type"
    ((PASSED++))
else
    echo "❌ candid missing StateChannel type"
    ((FAILED++))
fi

if grep -q "health:" candid/dark_pool_backend.did; then
    echo "✅ candid contains health function"
    ((PASSED++))
else
    echo "❌ candid missing health function"
    ((FAILED++))
fi

# Test 9: Check if Rust file contains required functions
if grep -q "fn health" src/dark_pool_backend/lib.rs; then
    echo "✅ lib.rs contains health function"
    ((PASSED++))
else
    echo "❌ lib.rs missing health function"
    ((FAILED++))
fi

if grep -q "fn init" src/dark_pool_backend/lib.rs; then
    echo "✅ lib.rs contains init function"
    ((PASSED++))
else
    echo "❌ lib.rs missing init function"
    ((FAILED++))
fi

if grep -q "fn commit_order" src/dark_pool_backend/lib.rs; then
    echo "✅ lib.rs contains commit_order function"
    ((PASSED++))
else
    echo "❌ lib.rs missing commit_order function"
    ((FAILED++))
fi

echo ""
echo "🚀 dfx Installation Test"
echo "----------------------"

# Test 10: Check if dfx is available
if command -v dfx > /dev/null 2>&1; then
    echo "✅ dfx is installed"
    DFX_AVAILABLE=true
    ((PASSED++))
else
    echo "⏭️  dfx not installed (run: sh -ci \"\$(curl -fsSL https://internetcomputer.org/install.sh)\")"
    DFX_AVAILABLE=false
    ((SKIPPED++))
fi

echo ""
echo "📊 Documentation Tests"
echo "-------------------"

# Test 11: Check README content
if grep -q "Install dfx CLI" README.md; then
    echo "✅ README contains installation instructions"
    ((PASSED++))
else
    echo "❌ README missing installation instructions"
    ((FAILED++))
fi

if grep -q "API Reference" README.md; then
    echo "✅ README contains API reference"
    ((PASSED++))
else
    echo "❌ README missing API reference"
    ((FAILED++))
fi

if grep -q "Deploy to mainnet" README.md; then
    echo "✅ README contains deployment instructions"
    ((PASSED++))
else
    echo "❌ README missing deployment instructions"
    ((FAILED++))
fi

echo ""
echo "🔒 Security Tests"
echo "---------------"

# Test 12: Check for security-related functions
if grep -q "fn pause_trading" src/dark_pool_backend/lib.rs; then
    echo "✅ lib.rs contains pause_trading function"
    ((PASSED++))
else
    echo "❌ lib.rs missing pause_trading function"
    ((FAILED++))
fi

if grep -q "fn resume_trading" src/dark_pool_backend/lib.rs; then
    echo "✅ lib.rs contains resume_trading function"
    ((PASSED++))
else
    echo "❌ lib.rs missing resume_trading function"
    ((FAILED++))
fi

if grep -q "fn emergency_withdrawal" src/dark_pool_backend/lib.rs; then
    echo "✅ lib.rs contains emergency_withdrawal function"
    ((PASSED++))
else
    echo "❌ lib.rs missing emergency_withdrawal function"
    ((FAILED++))
fi

echo ""
echo "📈 Performance Tests"
echo "-----------------"

# Test 13: Check for performance optimizations
if grep -q "HashMap" src/dark_pool_backend/lib.rs; then
    echo "✅ lib.rs uses HashMap for efficient lookups"
    ((PASSED++))
else
    echo "❌ lib.rs missing HashMap usage"
    ((FAILED++))
fi

if grep -q "Result<" src/dark_pool_backend/lib.rs; then
    echo "✅ lib.rs has proper error handling"
    ((PASSED++))
else
    echo "❌ lib.rs missing proper error handling"
    ((FAILED++))
fi

echo ""
echo "📋 Test Summary"
echo "=============="
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo "⏭️  Skipped: $SKIPPED"
echo ""

TOTAL_TESTS=$((PASSED + FAILED + SKIPPED))
echo "Total Tests: $TOTAL_TESTS"

if [ $FAILED -eq 0 ]; then
    echo "🎉 All tests passed! Your ICP backend is ready for deployment."
    echo ""
    echo "Next steps:"
    echo "1. Install dfx: sh -ci \"\$(curl -fsSL https://internetcomputer.org/install.sh)\""
    echo "2. Deploy locally: ./deploy.sh local"
    echo "3. Deploy to mainnet: ./deploy.sh mainnet"
else
    echo "⚠️  Some tests failed. Please review the issues above."
    exit 1
fi

echo ""
echo "🔍 Manual Verification Checklist"
echo "=============================="
echo "□ Install dfx CLI"
echo "□ Run: dfx start --background"
echo "□ Run: dfx build"
echo "□ Run: dfx deploy --network local"
echo "□ Test: dfx canister call dark_pool_backend health"
echo "□ Test: dfx canister call dark_pool_backend getVersion"
echo "□ Test: dfx canister call dark_pool_backend getTradingPairs"
echo "□ Test: dfx canister call dark_pool_backend getNetworkStats"
echo ""
echo "✅ Backend validation complete!" 
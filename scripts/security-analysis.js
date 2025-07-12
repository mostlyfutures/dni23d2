const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Security Analysis Script for Dark Pool DEX
 * Runs comprehensive security checks on smart contracts
 */

console.log('🔒 Starting Security Analysis for Dark Pool DEX...\n');

// Configuration
const CONTRACTS_DIR = './contracts';
const TEST_DIR = './test';
const REPORTS_DIR = './security-reports';

// Create reports directory if it doesn't exist
if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// Security check results
const securityReport = {
    timestamp: new Date().toISOString(),
    contracts: {},
    vulnerabilities: [],
    recommendations: [],
    overallScore: 0
};

/**
 * Run Solidity static analysis
 */
function runStaticAnalysis() {
    console.log('📊 Running Static Analysis...');
    
    try {
        // Check if slither is installed
        execSync('slither --version', { stdio: 'pipe' });
        
        // Run slither analysis
        const slitherOutput = execSync('slither . --json -', { encoding: 'utf8' });
        const slitherResults = JSON.parse(slitherOutput);
        
        securityReport.staticAnalysis = {
            tool: 'Slither',
            results: slitherResults,
            highIssues: slitherResults.results.detectors.filter(d => d.impact === 'High').length,
            mediumIssues: slitherResults.results.detectors.filter(d => d.impact === 'Medium').length,
            lowIssues: slitherResults.results.detectors.filter(d => d.impact === 'Low').length
        };
        
        console.log(`✅ Static Analysis Complete - ${securityReport.staticAnalysis.highIssues} High, ${securityReport.staticAnalysis.mediumIssues} Medium, ${securityReport.staticAnalysis.lowIssues} Low issues found`);
        
    } catch (error) {
        console.log('⚠️  Slither not available, skipping static analysis');
        securityReport.staticAnalysis = { error: 'Slither not installed' };
    }
}

/**
 * Check for common security patterns
 */
function checkSecurityPatterns() {
    console.log('🔍 Checking Security Patterns...');
    
    const contracts = fs.readdirSync(CONTRACTS_DIR).filter(f => f.endsWith('.sol'));
    const patterns = {
        reentrancyGuard: { found: false, contracts: [] },
        pausable: { found: false, contracts: [] },
        accessControl: { found: false, contracts: [] },
        safeMath: { found: false, contracts: [] },
        emergencyFunctions: { found: false, contracts: [] },
        timelock: { found: false, contracts: [] }
    };
    
    contracts.forEach(contractFile => {
        const contractPath = path.join(CONTRACTS_DIR, contractFile);
        const contractContent = fs.readFileSync(contractPath, 'utf8');
        
        // Check for security patterns
        if (contractContent.includes('ReentrancyGuard')) {
            patterns.reentrancyGuard.found = true;
            patterns.reentrancyGuard.contracts.push(contractFile);
        }
        
        if (contractContent.includes('Pausable')) {
            patterns.pausable.found = true;
            patterns.pausable.contracts.push(contractFile);
        }
        
        if (contractContent.includes('AccessControl')) {
            patterns.accessControl.found = true;
            patterns.accessControl.contracts.push(contractFile);
        }
        
        if (contractContent.includes('SafeMath')) {
            patterns.safeMath.found = true;
            patterns.safeMath.contracts.push(contractFile);
        }
        
        if (contractContent.includes('emergency') || contractContent.includes('Emergency')) {
            patterns.emergencyFunctions.found = true;
            patterns.emergencyFunctions.contracts.push(contractFile);
        }
        
        if (contractContent.includes('timelock') || contractContent.includes('Timelock')) {
            patterns.timelock.found = true;
            patterns.timelock.contracts.push(contractFile);
        }
        
        // Check for potential vulnerabilities
        if (contractContent.includes('delegatecall')) {
            securityReport.vulnerabilities.push({
                type: 'DELEGATECALL',
                severity: 'HIGH',
                contract: contractFile,
                description: 'delegatecall found - potential proxy vulnerability'
            });
        }
        
        if (contractContent.includes('selfdestruct')) {
            securityReport.vulnerabilities.push({
                type: 'SELFDESTRUCT',
                severity: 'HIGH',
                contract: contractFile,
                description: 'selfdestruct found - potential fund loss'
            });
        }
        
        if (contractContent.includes('suicide')) {
            securityReport.vulnerabilities.push({
                type: 'SUICIDE',
                severity: 'HIGH',
                contract: contractFile,
                description: 'suicide found - potential fund loss'
            });
        }
        
        // Check for unchecked external calls
        const externalCallPattern = /\.call\(/g;
        const externalCalls = contractContent.match(externalCallPattern);
        if (externalCalls && externalCalls.length > 0) {
            securityReport.vulnerabilities.push({
                type: 'UNCHECKED_EXTERNAL_CALL',
                severity: 'MEDIUM',
                contract: contractFile,
                description: `${externalCalls.length} external calls found - should check return values`
            });
        }
        
        // Check for hardcoded addresses
        const hardcodedAddressPattern = /0x[a-fA-F0-9]{40}/g;
        const hardcodedAddresses = contractContent.match(hardcodedAddressPattern);
        if (hardcodedAddresses && hardcodedAddresses.length > 0) {
            securityReport.vulnerabilities.push({
                type: 'HARDCODED_ADDRESS',
                severity: 'LOW',
                contract: contractFile,
                description: `${hardcodedAddresses.length} hardcoded addresses found`
            });
        }
    });
    
    securityReport.patterns = patterns;
    
    // Generate recommendations based on patterns
    if (!patterns.reentrancyGuard.found) {
        securityReport.recommendations.push('Add ReentrancyGuard to prevent reentrancy attacks');
    }
    
    if (!patterns.pausable.found) {
        securityReport.recommendations.push('Add Pausable functionality for emergency stops');
    }
    
    if (!patterns.accessControl.found) {
        securityReport.recommendations.push('Implement proper access control mechanisms');
    }
    
    if (!patterns.safeMath.found) {
        securityReport.recommendations.push('Use SafeMath for arithmetic operations to prevent overflows');
    }
    
    if (!patterns.emergencyFunctions.found) {
        securityReport.recommendations.push('Add emergency functions for crisis management');
    }
    
    if (!patterns.timelock.found) {
        securityReport.recommendations.push('Implement timelock for critical operations');
    }
    
    console.log('✅ Security Pattern Analysis Complete');
}

/**
 * Check test coverage
 */
function checkTestCoverage() {
    console.log('🧪 Checking Test Coverage...');
    
    const testFiles = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.js'));
    
    securityReport.testCoverage = {
        testFiles: testFiles,
        totalTests: 0,
        securityTests: 0,
        coverageAreas: []
    };
    
    testFiles.forEach(testFile => {
        const testPath = path.join(TEST_DIR, testFile);
        const testContent = fs.readFileSync(testPath, 'utf8');
        
        // Count test cases
        const testCases = testContent.match(/it\(/g);
        if (testCases) {
            securityReport.testCoverage.totalTests += testCases.length;
        }
        
        // Check for security-related tests
        const securityKeywords = ['reentrancy', 'overflow', 'underflow', 'access', 'emergency', 'timelock', 'pause'];
        securityKeywords.forEach(keyword => {
            if (testContent.toLowerCase().includes(keyword)) {
                securityReport.testCoverage.securityTests++;
            }
        });
        
        // Check coverage areas
        if (testContent.includes('describe(')) {
            const describeBlocks = testContent.match(/describe\(['"`]([^'"`]+)['"`]/g);
            if (describeBlocks) {
                describeBlocks.forEach(block => {
                    const area = block.match(/describe\(['"`]([^'"`]+)['"`]/)[1];
                    if (!securityReport.testCoverage.coverageAreas.includes(area)) {
                        securityReport.testCoverage.coverageAreas.push(area);
                    }
                });
            }
        }
    });
    
    console.log(`✅ Test Coverage Analysis Complete - ${securityReport.testCoverage.totalTests} total tests, ${securityReport.testCoverage.securityTests} security tests`);
}

/**
 * Check dependency security
 */
function checkDependencies() {
    console.log('📦 Checking Dependencies...');
    
    try {
        const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
        
        securityReport.dependencies = {
            total: Object.keys(packageJson.dependencies || {}).length + Object.keys(packageJson.devDependencies || {}).length,
            openzeppelin: false,
            hardhat: false,
            ethers: false,
            securityTools: []
        };
        
        const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies
        };
        
        if (allDeps['@openzeppelin/contracts']) {
            securityReport.dependencies.openzeppelin = true;
        }
        
        if (allDeps['hardhat']) {
            securityReport.dependencies.hardhat = true;
        }
        
        if (allDeps['ethers']) {
            securityReport.dependencies.ethers = true;
        }
        
        // Check for security tools
        const securityTools = ['slither', 'mythril', 'oyente', 'manticore'];
        securityTools.forEach(tool => {
            if (allDeps[tool] || allDeps[`@${tool}`]) {
                securityReport.dependencies.securityTools.push(tool);
            }
        });
        
        console.log('✅ Dependency Analysis Complete');
        
    } catch (error) {
        console.log('⚠️  Could not analyze dependencies');
        securityReport.dependencies = { error: 'Could not read package.json' };
    }
}

/**
 * Calculate overall security score
 */
function calculateSecurityScore() {
    let score = 100;
    
    // Deduct points for vulnerabilities
    securityReport.vulnerabilities.forEach(vuln => {
        switch (vuln.severity) {
            case 'HIGH':
                score -= 20;
                break;
            case 'MEDIUM':
                score -= 10;
                break;
            case 'LOW':
                score -= 5;
                break;
        }
    });
    
    // Add points for security patterns
    if (securityReport.patterns.reentrancyGuard.found) score += 10;
    if (securityReport.patterns.pausable.found) score += 10;
    if (securityReport.patterns.accessControl.found) score += 10;
    if (securityReport.patterns.safeMath.found) score += 5;
    if (securityReport.patterns.emergencyFunctions.found) score += 10;
    if (securityReport.patterns.timelock.found) score += 10;
    
    // Add points for test coverage
    if (securityReport.testCoverage.totalTests > 50) score += 10;
    if (securityReport.testCoverage.securityTests > 10) score += 10;
    
    // Add points for dependencies
    if (securityReport.dependencies.openzeppelin) score += 10;
    if (securityReport.dependencies.securityTools.length > 0) score += 5;
    
    securityReport.overallScore = Math.max(0, Math.min(100, score));
}

/**
 * Generate security report
 */
function generateReport() {
    console.log('📋 Generating Security Report...');
    
    const reportPath = path.join(REPORTS_DIR, `security-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(securityReport, null, 2));
    
    // Generate human-readable summary
    const summaryPath = path.join(REPORTS_DIR, `security-summary-${Date.now()}.md`);
    const summary = generateSummary();
    fs.writeFileSync(summaryPath, summary);
    
    console.log(`✅ Security Report Generated:`);
    console.log(`   📄 JSON Report: ${reportPath}`);
    console.log(`   📄 Summary: ${summaryPath}`);
}

/**
 * Generate human-readable summary
 */
function generateSummary() {
    const score = securityReport.overallScore;
    const scoreColor = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
    
    return `# Security Analysis Report - Dark Pool DEX

## Overall Security Score: ${scoreColor} ${score}/100

### Executive Summary
This report provides a comprehensive security analysis of the Dark Pool DEX smart contracts.

### Key Findings

#### Vulnerabilities Found
${securityReport.vulnerabilities.length === 0 ? '✅ No vulnerabilities detected' : 
securityReport.vulnerabilities.map(v => `- **${v.severity}**: ${v.type} in ${v.contract} - ${v.description}`).join('\n')}

#### Security Patterns Implemented
- ReentrancyGuard: ${securityReport.patterns.reentrancyGuard.found ? '✅' : '❌'}
- Pausable: ${securityReport.patterns.pausable.found ? '✅' : '❌'}
- AccessControl: ${securityReport.patterns.accessControl.found ? '✅' : '❌'}
- SafeMath: ${securityReport.patterns.safeMath.found ? '✅' : '❌'}
- Emergency Functions: ${securityReport.patterns.emergencyFunctions.found ? '✅' : '❌'}
- Timelock: ${securityReport.patterns.timelock.found ? '✅' : '❌'}

#### Test Coverage
- Total Tests: ${securityReport.testCoverage.totalTests}
- Security Tests: ${securityReport.testCoverage.securityTests}
- Coverage Areas: ${securityReport.testCoverage.coverageAreas.join(', ')}

#### Dependencies
- OpenZeppelin Contracts: ${securityReport.dependencies.openzeppelin ? '✅' : '❌'}
- Security Tools: ${securityReport.dependencies.securityTools.join(', ') || 'None'}

### Recommendations
${securityReport.recommendations.length === 0 ? '✅ All security recommendations implemented' :
securityReport.recommendations.map(r => `- ${r}`).join('\n')}

### Next Steps
1. Address any HIGH severity vulnerabilities immediately
2. Implement missing security patterns
3. Increase test coverage for security scenarios
4. Consider additional security audits
5. Implement monitoring and alerting systems

---
*Report generated on ${new Date().toLocaleString()}*
`;
}

/**
 * Main execution
 */
async function main() {
    try {
        runStaticAnalysis();
        checkSecurityPatterns();
        checkTestCoverage();
        checkDependencies();
        calculateSecurityScore();
        generateReport();
        
        console.log('\n🎉 Security Analysis Complete!');
        console.log(`Overall Security Score: ${securityReport.overallScore}/100`);
        
        if (securityReport.vulnerabilities.length > 0) {
            console.log(`\n⚠️  ${securityReport.vulnerabilities.length} vulnerabilities found. Please review the report.`);
        } else {
            console.log('\n✅ No vulnerabilities detected!');
        }
        
    } catch (error) {
        console.error('❌ Security analysis failed:', error);
        process.exit(1);
    }
}

// Run the analysis
main(); 
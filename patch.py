import re

file_path = 'c:/Users/12096/ParcelIQ/frontend/src/components/PropertyDashboard.jsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the handler
old_handler_pattern = r'    const handleExportReport = useCallback\(\(\) => \{.+?    \}, \[analysisResult, address\]\);'
new_handler = '''    const handleExportReport = useCallback(async () => {
        if (!analysisResult) return;
        
        // If not on the dashboard mode, we can't capture the DOM
        if (viewMode !== 'dashboard') {
            alert('Please switch to the Data Dashboard view first to export the visual report with graphs.');
            return;
        }

        const input = document.getElementById('pdf-export-content');
        if (!input) return;

        try {
            await new Promise(r => setTimeout(r, 100));

            const canvas = await html2canvas(input, { 
                scale: 1.5, 
                useCORS: true, 
                backgroundColor: '#0f172a',
                logging: false
            });
            const imgData = canvas.toDataURL('image/png');
            
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`ParcelIQ_Risk_Report_${address.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
            
        } catch (error) {
            console.error("Failed to generate PDF Export", error);
            alert("Sorry, we encountered an error exporting the PDF.");
        }
    }, [analysisResult, address, viewMode]);'''

content = re.sub(old_handler_pattern, new_handler, content, flags=re.DOTALL)

# Add imports if they don't exist
if 'import jsPDF' not in content:
    content = content.replace("import { Download } from 'lucide-react';", "import { Download } from 'lucide-react';\\nimport jsPDF from 'jspdf';\\nimport html2canvas from 'html2canvas';")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

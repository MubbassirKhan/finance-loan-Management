function formatNumber(value) {
  return new Intl.NumberFormat('en-IN').format(Number(value) || 0)
}

function formatPdfCurrency(value) {
  return `INR ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`
}

function getPeriodLabel(period, month, year) {
  if (month) return period.replace('W', 'Week ')
  const [periodYear, periodMonth] = period.split('-').map(Number)
  return new Date(periodYear || year, (periodMonth || 1) - 1, 1).toLocaleDateString('en-IN', { month: 'short' })
}

function getReportSpec(report, type, filters) {
  const trend = report.trend
  if (type === 'membership') {
    return {
      title: 'Membership Summary Report',
      sheetName: 'Membership',
      metrics: [
        ['Members registered', report.summary.membership_count, false],
        ['Currently active members', report.summary.active_members, false],
      ],
      detail: {
        title: filters.month ? 'Weekly Membership Activity' : 'Monthly Membership Activity',
        headers: ['Period', 'Members registered'],
        rows: trend.map((row) => [getPeriodLabel(row.period, filters.month, filters.year), row.membership_count]),
        currencyColumns: [],
      },
    }
  }

  if (type === 'loans') {
    return {
      title: 'Loan Sanctions Report',
      sheetName: 'Loan Sanctions',
      metrics: [
        ['Loans sanctioned', report.summary.loan_count, false],
        ['Total sanctioned amount', Number(report.summary.sanctioned_amount), true],
      ],
      detail: {
        title: filters.month ? 'Weekly Loan Sanctions' : 'Monthly Loan Sanctions',
        headers: ['Period', 'Loans sanctioned', 'Sanctioned amount (INR)'],
        rows: trend.map((row) => [
          getPeriodLabel(row.period, filters.month, filters.year),
          row.loan_count,
          Number(row.sanctioned_amount),
        ]),
        currencyColumns: [3],
      },
    }
  }

  if (type === 'recovery') {
    return {
      title: 'Principal Recovery Report',
      sheetName: 'Recovery',
      metrics: [['Principal recovered', Number(report.summary.recovered_amount), true]],
      detail: {
        title: filters.month ? 'Weekly Recovery Activity' : 'Monthly Recovery Activity',
        headers: ['Period', 'Principal recovered (INR)'],
        rows: trend.map((row) => [
          getPeriodLabel(row.period, filters.month, filters.year),
          Number(row.recovered_amount),
        ]),
        currencyColumns: [2],
      },
    }
  }

  if (type === 'portfolio') {
    return {
      title: 'Current Portfolio Balance Report',
      sheetName: 'Portfolio Balance',
      metrics: [
        ['Outstanding principal', Number(report.summary.outstanding_amount), true],
        ['Open loans', report.summary.open_loans, false],
        ['Closed loans', report.summary.closed_loans, false],
      ],
      scope: 'Current full portfolio snapshot',
    }
  }

  const dimension = type === 'gender' ? report.gender_breakdown : report.caste_breakdown
  const totalMembers = dimension.reduce((sum, row) => sum + row.membership_count, 0)
  const totalLoans = dimension.reduce((sum, row) => sum + row.loan_count, 0)
  const totalSanctioned = dimension.reduce((sum, row) => sum + Number(row.sanctioned_amount), 0)
  const totalRecovered = dimension.reduce((sum, row) => sum + Number(row.recovered_amount), 0)
  return {
    title: type === 'gender' ? 'Gender-wise Report' : 'Caste-wise Report',
    sheetName: type === 'gender' ? 'Gender' : 'Caste',
    metrics: [
      ['Members registered', totalMembers, false],
      ['Loans sanctioned', totalLoans, false],
      ['Sanctioned amount', totalSanctioned, true],
      ['Principal recovered', totalRecovered, true],
    ],
    detail: {
      title: type === 'gender' ? 'Gender Breakdown' : 'Caste Breakdown',
      headers: ['Category', 'Members', 'Loans', 'Sanctioned (INR)', 'Recovered (INR)'],
      rows: dimension.map((row) => [
        row.label,
        row.membership_count,
        row.loan_count,
        Number(row.sanctioned_amount),
        Number(row.recovered_amount),
      ]),
      currencyColumns: [4, 5],
    },
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function exportExcel(report, spec, periodLabel, filename) {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'SP Office Membership System'
  workbook.subject = spec.title
  const worksheet = workbook.addWorksheet(spec.sheetName, { views: [{ state: 'frozen', ySplit: 1 }] })
  const columnCount = Math.max(2, spec.detail?.headers.length || 2)
  worksheet.addRow(['POLICE CREDIT CO-OPERATIVE SOCIETY'])
  worksheet.mergeCells(1, 1, 1, columnCount)
  worksheet.addRow([spec.title])
  worksheet.addRow(['Reporting period', periodLabel])
  worksheet.addRow(['Report scope', spec.scope || periodLabel])
  worksheet.addRow([])
  worksheet.addRow(['Summary item', 'Value'])
  spec.metrics.forEach(([label, value]) => worksheet.addRow([label, value]))
  const metricStartRow = 7
  spec.metrics.forEach((metric, index) => {
    worksheet.getCell(metricStartRow + index, 1).value = metric[0]
    if (metric[2]) worksheet.getCell(metricStartRow + index, 2).numFmt = '"₹"#,##0.00'
  })

  if (spec.detail) {
    worksheet.addRow([])
    worksheet.addRow([spec.detail.title])
    const headerRow = worksheet.addRow(spec.detail.headers)
    spec.detail.rows.forEach((values) => worksheet.addRow(values))
    spec.detail.currencyColumns.forEach((column) => {
      for (let rowNumber = headerRow.number + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        worksheet.getCell(rowNumber, column).numFmt = '"₹"#,##0.00'
      }
    })
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } }
  }

  worksheet.getRow(1).font = { bold: true, size: 15, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } }
  worksheet.getRow(6).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  worksheet.getRow(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17324D' } }
  worksheet.columns = Array.from({ length: columnCount }, (_, index) => ({ width: index === 0 ? 32 : 22 }))

  const buffer = await workbook.xlsx.writeBuffer()
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${filename}.xlsx`,
  )
}

async function exportPdf(spec, periodLabel, filename) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 42
  const bodyWidth = pageWidth - margin * 2
  pdf.setProperties({
    title: spec.title,
    subject: `SP Office report for ${periodLabel}`,
    creator: 'SP Office Membership System',
  })
  pdf.setTextColor(16, 43, 70)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(15)
  pdf.text('POLICE CREDIT CO-OPERATIVE SOCIETY', margin, 42)
  pdf.setFontSize(11)
  pdf.text(spec.title, margin, 62, { maxWidth: bodyWidth })
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(90, 105, 120)
  pdf.text(`Reporting period: ${periodLabel}`, margin, 80)
  pdf.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - margin, 80, { align: 'right' })
  pdf.setDrawColor(183, 138, 50)
  pdf.setLineWidth(1.2)
  pdf.line(margin, 92, pageWidth - margin, 92)

  autoTable(pdf, {
    startY: 108,
    head: [['Summary item', 'Value']],
    body: spec.metrics.map(([label, value, isCurrency]) => [
      label,
      isCurrency ? formatPdfCurrency(value) : formatNumber(value),
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 7, textColor: [35, 48, 61], lineColor: [220, 226, 231], lineWidth: 0.4 },
    headStyles: { fillColor: [23, 50, 77], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [246, 248, 250] },
    margin: { left: margin, right: margin, bottom: 42 },
    columnStyles: { 0: { cellWidth: 290 }, 1: { cellWidth: 'auto', halign: 'right' } },
  })

  if (spec.detail) {
    let detailTitleY = pdf.lastAutoTable.finalY + 28
    if (detailTitleY + 35 > pageHeight - 42) {
      pdf.addPage()
      detailTitleY = 54
    }
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(10)
    pdf.setTextColor(16, 43, 70)
    pdf.text(spec.detail.title, margin, detailTitleY, { maxWidth: bodyWidth })

    const detailRows = spec.detail.rows.length
      ? spec.detail.rows.map((row) => row.map((value, index) => (
        spec.detail.currencyColumns.includes(index + 1) ? formatPdfCurrency(value) : String(value ?? '')
      )))
      : [[`No records for ${periodLabel}.`, ...Array(Math.max(0, spec.detail.headers.length - 1)).fill('')]]
    const columnStyles = spec.detail.headers.length === 5
      ? {
        0: { cellWidth: 105 },
        1: { cellWidth: 55, halign: 'right' },
        2: { cellWidth: 50, halign: 'right' },
        3: { cellWidth: 128, halign: 'right' },
        4: { cellWidth: 'auto', halign: 'right' },
      }
      : spec.detail.headers.length === 3
        ? {
          0: { cellWidth: 125 },
          1: { cellWidth: 105, halign: 'right' },
          2: { cellWidth: 'auto', halign: 'right' },
        }
        : { 0: { cellWidth: 170 }, 1: { cellWidth: 'auto', halign: 'right' } }

    autoTable(pdf, {
      startY: detailTitleY + 10,
      head: [spec.detail.headers],
      body: detailRows,
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 6, textColor: [35, 48, 61], lineColor: [220, 226, 231], lineWidth: 0.4, overflow: 'linebreak' },
      headStyles: { fillColor: [23, 50, 77], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [246, 248, 250] },
      margin: { left: margin, right: margin, bottom: 42 },
      columnStyles,
    })
  }

  const pageCount = pdf.getNumberOfPages()
  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    pdf.setPage(pageNumber)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(110, 120, 130)
    pdf.text(`SP Office · ${spec.title}`, margin, pageHeight - 22, { maxWidth: bodyWidth - 80 })
    pdf.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - margin, pageHeight - 22, { align: 'right' })
  }
  pdf.save(`${filename}.pdf`)
}

const reportExportService = {
  export: async ({ report, type, format, filters }) => {
    const spec = getReportSpec(report, type, filters)
    const periodLabel = type === 'portfolio'
      ? 'Current full portfolio snapshot'
      : filters.month
        ? `${new Date(filters.year, filters.month - 1, 1).toLocaleDateString('en-IN', { month: 'long' })} ${filters.year}`
        : `Calendar year ${filters.year}`
    const filename = `sp-office-${type}-${filters.year}${filters.month ? `-${String(filters.month).padStart(2, '0')}` : ''}-${new Date().toISOString().slice(0, 10)}`
    if (format === 'excel') return exportExcel(report, spec, periodLabel, filename)
    return exportPdf(spec, periodLabel, filename)
  },
}

export default reportExportService
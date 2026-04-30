import { forwardRef } from "react";

const TYPE_LABELS = {
  A: "ការ៉ុត",
  B: "បាកាន",
  C: "សំបកក្រហមស",
};

const SHOP_PHONES = ["0887811477", "0884691231", "017419141"];
const QR_IMAGE = "/qr.png";
const LEFT_LOGO_IMAGE = "/logo-left.png";
const RIGHT_LOGO_IMAGE = "/logo-right.png";
const INVOICE_BLUE = "#173f8f";
const SHOP_ADDRESS =
  "អាសយដ្ឋាន: ផ្ទះ 28BE1 ផ្លូវ 223, ភូមិ 12 សង្កាត់ផ្សារដើមគរ ខណ្ឌទួលគោក, រាជធានីភ្នំពេញ";

const COL_WIDTHS = {
  no: "7%",
  name: "31%",
  qty: "17%",
  unitPrice: "21%",
  amount: "24%",
};

function formatKg(kg) {
  const value = Number(kg || 0);
  if (value >= 1000) return `${(value / 1000).toLocaleString()} តោន`;
  return `${value.toLocaleString()} គីឡូ`;
}

function formatRiel(value) {
  return `${Number(value || 0).toLocaleString()} រៀល`;
}

function productKhmer(product) {
  if (!product) return "—";
  return `${TYPE_LABELS[product.type] || product.type} លេខ ${product.grade}`;
}

function itemProductKhmer(item) {
  if (item?.is_delivery_fee) return "ថ្លៃដឹកជញ្ជូន";
  if (item?.name) return item.name;
  return productKhmer(item?.product || item);
}

function formatInvoiceDateTime(value) {
  const date = value ? new Date(value) : new Date();

  return {
    date: date.toLocaleDateString("en-GB"),
    time: date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

function getCustomerName(invoice) {
  return invoice.customer?.name || invoice.customer_name || "-";
}

function getCustomerPhone(invoice) {
  return invoice.customer?.phone || invoice.customer_phone || "-";
}

function getInvoiceDateValue(invoice) {
  return invoice.created_at || invoice.invoice_date || new Date();
}

function getPaidAmount(invoice) {
  if (Array.isArray(invoice.payments) && invoice.payments.length > 0) {
    return invoice.payments.reduce((sum, p) => {
      return sum + Number(
        p.amount ??
        p.paid_amount ??
        p.payment_amount ??
        p.deposit_amount ??
        0
      );
    }, 0);
  }

  if (invoice.paid_amount !== undefined && invoice.paid_amount !== null) {
    return Number(invoice.paid_amount || 0);
  }

  if (invoice.deposit_amount !== undefined && invoice.deposit_amount !== null) {
    return Number(invoice.deposit_amount || 0);
  }

  if (invoice.payment_status === "paid") {
    return Number(invoice.total_amount || 0);
  }

  return 0;
}

function getBalanceAmount(invoice) {
  if (invoice.balance_amount !== undefined && invoice.balance_amount !== null) {
    return Number(invoice.balance_amount || 0);
  }

  const total = Number(invoice.total_amount || 0);
  const paid = getPaidAmount(invoice);

  return Math.max(total - paid, 0);
}

function getPaymentStatus(invoice) {
  const total = Number(invoice.total_amount || 0);
  const paid = getPaidAmount(invoice);

  if (paid <= 0) return "unpaid";
  if (paid >= total) return "paid";
  return "debt";
}

function getPaymentKhmer(status) {
  if (status === "paid") return "បានទូទាត់";
  if (status === "debt") return "ជំពាក់";
  return "មិនទាន់ទូទាត់";
}

const PrintInvoice = forwardRef(function PrintInvoice({ invoice, captureMode = false }, ref) {
  if (!invoice) return null;

  const isImageCapture = Boolean(ref) || captureMode;
  const invoiceDateTime = formatInvoiceDateTime(getInvoiceDateValue(invoice));

  const paidAmount = getPaidAmount(invoice);
  const balanceAmount = getBalanceAmount(invoice);
  const paymentStatus = getPaymentStatus(invoice);
  const paymentLabel = getPaymentKhmer(paymentStatus);

  const paymentColor =
    paymentStatus === "paid"
      ? "#15803d"
      : paymentStatus === "debt"
        ? "#d97706"
        : "#dc2626";

  const paperWidth = isImageCapture ? "794px" : "210mm";
  const paperHeight = isImageCapture ? "1123px" : "297mm";
  const paperPadding = isImageCapture ? "38px 53px" : "10mm 14mm";
  const imageSize = "180px";
  const headerGrid = "180px 1fr 180px";
  const topInfoGrid = isImageCapture ? "1fr 219px" : "1fr 58mm";
  const qrSize = "155px";

  const tableHeaderHeight = isImageCapture ? "54px" : "45px";
  const tableRowHeight = isImageCapture ? "41px" : "33px";
  const summaryRowHeight = isImageCapture ? "39px" : "33px";

  const tableFontSize = isImageCapture ? "19px" : "17px";
  const productFontSize = isImageCapture ? "18px" : "16px";
  const tableLineHeight = isImageCapture ? "25px" : "20px";
  const headerKhFont = isImageCapture ? "17px" : "15px";
  const headerEnFont = isImageCapture ? "11px" : "10px";
  const textLift = isImageCapture ? "-10px" : "0px";

  const invoiceItems = [
    ...(invoice?.items || []),
    ...(Number(invoice?.delivery_fee || 0) > 0
      ? [
          {
            id: "delivery-fee",
            is_delivery_fee: true,
            subtotal: Number(invoice.delivery_fee || 0),
          },
        ]
      : []),
  ];

  const rows = Array.from({ length: 10 }).map((_, index) => {
    return invoiceItems?.[index] || { id: `empty-${index}`, empty: true };
  });

  const borderStyle = {
    border: `1px solid ${INVOICE_BLUE}`,
  };

  const headerCellStyle = {
    ...borderStyle,
    padding: 0,
    textAlign: "center",
    verticalAlign: "middle",
    fontWeight: 900,
    height: tableHeaderHeight,
    lineHeight: "18px",
  };

  const bodyCellBase = {
    ...borderStyle,
    padding: "0 9px",
    verticalAlign: "middle",
    fontWeight: 900,
    fontSize: tableFontSize,
    lineHeight: tableLineHeight,
    height: tableRowHeight,
  };

  const summaryCell = {
    ...borderStyle,
    height: summaryRowHeight,
    lineHeight: tableLineHeight,
    padding: "0 8px",
    textAlign: "center",
    verticalAlign: "middle",
    fontWeight: 900,
    whiteSpace: "nowrap",
  };

  const tableText = {
    display: "flex",
    alignItems: "center",
    height: "100%",
    transform: `translateY(${textLift})`,
  };

  const tableTextCenter = {
    ...tableText,
    justifyContent: "center",
    textAlign: "center",
  };

  const tableTextRight = {
    ...tableText,
    justifyContent: "flex-end",
    textAlign: "right",
  };

  const tableTextLeft = {
    ...tableText,
    justifyContent: "flex-start",
    textAlign: "left",
  };

  return (
    <div
      ref={ref}
      id={isImageCapture ? "invoice-capture" : undefined}
      className={`print-invoice-root ${isImageCapture ? "capture" : "print-only"}`}
      style={{
        display: isImageCapture ? "block" : "none",
        position: isImageCapture ? "fixed" : "static",
        left: isImageCapture ? "-10000px" : "auto",
        top: 0,
        width: paperWidth,
        height: paperHeight,
        background: "#ffffff",
        color: INVOICE_BLUE,
        overflow: "hidden",
      }}
    >
      <style>
        {`
          @page {
            size: A4 portrait;
            margin: 0;
          }

          @media print {
            html,
            body {
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
              background: #ffffff !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            body * {
              visibility: hidden !important;
            }

            .print-invoice-root.capture {
              display: none !important;
              visibility: hidden !important;
            }

            .print-invoice-root.print-only {
              display: block !important;
              visibility: visible !important;
              position: fixed !important;
              inset: 0 !important;
              width: 210mm !important;
              height: 297mm !important;
              background: #ffffff !important;
              margin: 0 !important;
              padding: 0 !important;
              overflow: hidden !important;
            }

            .print-invoice-root.print-only *,
            .heng-huy-print,
            .heng-huy-print * {
              visibility: visible !important;
            }

            .heng-huy-print {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              overflow: hidden !important;
              page-break-before: avoid !important;
              page-break-after: avoid !important;
              page-break-inside: avoid !important;
            }
          }
        `}
      </style>

      <div
        className="heng-huy-print"
        style={{
          position: "relative",
          width: paperWidth,
          height: paperHeight,
          padding: paperPadding,
          boxSizing: "border-box",
          background: "#ffffff",
          color: INVOICE_BLUE,
          fontFamily:
            "'Noto Sans Khmer', 'Khmer OS Battambang', 'Khmer OS', Arial, sans-serif",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: headerGrid,
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img
              crossOrigin="anonymous"
              src={LEFT_LOGO_IMAGE}
              alt="Left Logo"
              style={{
                width: imageSize,
                height: imageSize,
                objectFit: "cover",
                borderRadius: "12px",
                display: "block",
              }}
            />
          </div>

          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontSize: "32px",
                color: "#c0152b",
                fontWeight: 900,
                lineHeight: "44px",
              }}
            >
              ហេង ហ៊ុយ
            </h1>

            <h2
              style={{
                margin: "2px 0 0",
                fontSize: "26px",
                color: "#1a7a2e",
                fontWeight: 900,
                lineHeight: "32px",
              }}
            >
              HENG HUY
            </h2>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "13px",
                fontWeight: 700,
                lineHeight: "20px",
              }}
            >
              មានទិញ-លក់ ដំឡូងជ្វា ល្ពៅ និងបន្លែគ្រប់មុខ
            </p>

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "18px",
                fontWeight: 900,
                lineHeight: "26px",
              }}
            >
              វិក្កយបត្រ
            </p>

            <p
              style={{
                margin: "2px 0 0",
                fontSize: "16px",
                fontWeight: 900,
                lineHeight: "20px",
                textDecoration: "underline",
              }}
            >
              INVOICE
            </p>

            <p
              style={{
                margin: "8px 0 0",
                fontSize: "26px",
                fontWeight: 900,
                lineHeight: "32px",
                letterSpacing: "1px",
              }}
            >
              {invoice.invoice_no}
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "center" }}>
            <img
              crossOrigin="anonymous"
              src={RIGHT_LOGO_IMAGE}
              alt="Right Logo"
              style={{
                width: imageSize,
                height: imageSize,
                objectFit: "cover",
                borderRadius: "12px",
                display: "block",
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns: topInfoGrid,
            gap: "24px",
            fontWeight: 700,
            lineHeight: "32px",
          }}
        >
          <div style={{ fontSize: "15px" }}>
            <p style={{ margin: 0 }}>
              ថ្ងៃទី:{" "}
              <span style={{ fontWeight: 900, fontSize: "18px" }}>
                {invoiceDateTime.date}, {invoiceDateTime.time}
              </span>
            </p>

            <p style={{ margin: 0 }}>
              អតិថិជន:{" "}
              <span style={{ fontWeight: 900, fontSize: "18px" }}>
                {getCustomerName(invoice)}
              </span>
            </p>

            <p style={{ margin: 0 }}>
              លេខទូរស័ព្ទ:{" "}
              <span style={{ fontWeight: 900, fontSize: "18px" }}>
                {getCustomerPhone(invoice)}
              </span>
            </p>
          </div>

          <div style={{ fontWeight: 900, fontSize: "18px", lineHeight: "32px" }}>
            <div
              style={{
                marginLeft: "auto",
                width: "fit-content",
                display: "grid",
                gridTemplateColumns: "22px auto",
                alignItems: "center",
                columnGap: "4px",
              }}
            >
              {SHOP_PHONES.map((phone) => (
                <div key={phone} style={{ display: "contents" }}>
                  <span style={{ textAlign: "center", lineHeight: 1 }}>☎</span>
                  <span>{phone}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <table
          style={{
            marginTop: "18px",
            width: "100%",
            tableLayout: "fixed",
            borderCollapse: "collapse",
            fontWeight: 700,
            fontSize: "14px",
          }}
        >
          <colgroup>
            <col style={{ width: COL_WIDTHS.no }} />
            <col style={{ width: COL_WIDTHS.name }} />
            <col style={{ width: COL_WIDTHS.qty }} />
            <col style={{ width: COL_WIDTHS.unitPrice }} />
            <col style={{ width: COL_WIDTHS.amount }} />
          </colgroup>

          <thead>
            <tr style={{ height: tableHeaderHeight }}>
              {[
                ["ល.រ", "No"],
                ["ឈ្មោះទំនិញ", "Name of goods"],
                ["ចំនួន", "Quantity"],
                ["តម្លៃរាយ", "Unit Price"],
                ["តម្លៃសរុប", "Amount"],
              ].map(([kh, en]) => (
                <th key={en} style={headerCellStyle}>
                  <div style={tableTextCenter}>
                    <div>
                      <div style={{ fontSize: headerKhFont, lineHeight: "22px" }}>
                        {kh}
                      </div>
                      <div style={{ fontSize: headerEnFont, lineHeight: "13px" }}>
                        {en}
                      </div>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((item, index) => (
              <tr key={item.id || index} style={{ height: tableRowHeight }}>
                <td style={{ ...bodyCellBase, padding: 0 }}>
                  <div style={tableTextCenter}>{index + 1}</div>
                </td>

                <td style={{ ...bodyCellBase, fontSize: productFontSize }}>
                  <div style={tableTextLeft}>
                    {item.empty ? "" : itemProductKhmer(item)}
                  </div>
                </td>

                <td style={{ ...bodyCellBase, padding: "0 6px" }}>
                  <div style={tableTextCenter}>
                    {item.empty || item.is_delivery_fee ? "" : formatKg(item.quantity_kg)}
                  </div>
                </td>

                <td style={{ ...bodyCellBase }}>
                  <div style={tableTextRight}>
                    {item.empty || item.is_delivery_fee ? "" : formatRiel(item.price_per_kg)}
                  </div>
                </td>

                <td style={{ ...bodyCellBase }}>
                  <div style={tableTextRight}>
                    {item.empty ? "" : formatRiel(item.subtotal)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div
          style={{
            display: "grid",
            width: "100%",
            alignItems: "start",
            gridTemplateColumns: `${COL_WIDTHS.no} ${COL_WIDTHS.name} ${COL_WIDTHS.qty} ${COL_WIDTHS.unitPrice} ${COL_WIDTHS.amount}`,
          }}
        >
          <div style={{ gridColumn: "span 3", paddingTop: "8px" }}>
            <img
              crossOrigin="anonymous"
              src={QR_IMAGE}
              alt="QR"
              style={{
                width: qrSize,
                height: qrSize,
                objectFit: "contain",
                display: "block",
              }}
            />

            <p
              style={{
                margin: "6px 0 0",
                fontSize: "15px",
                lineHeight: "25px",
                fontWeight: 700,
                color: INVOICE_BLUE,
                whiteSpace: "nowrap",
              }}
            >
              {SHOP_ADDRESS}
            </p>
          </div>

          <table
            style={{
              gridColumn: "span 2",
              width: "100%",
              tableLayout: "fixed",
              borderCollapse: "collapse",
              fontWeight: 700,
              marginTop: "-1px",
            }}
          >
            <colgroup>
              <col style={{ width: "46.6667%" }} />
              <col style={{ width: "53.3333%" }} />
            </colgroup>

            <tbody>
              <tr style={{ height: summaryRowHeight }}>
                <td style={{ ...summaryCell, fontSize: isImageCapture ? "15px" : "14px" }}>
                  <div style={tableTextCenter}>សរុប/Total</div>
                </td>

                <td style={{ ...summaryCell, fontSize: isImageCapture ? "18px" : "17px" }}>
                  <div style={tableTextCenter}>{formatRiel(invoice.total_amount)}</div>
                </td>
              </tr>

              <tr style={{ height: summaryRowHeight }}>
                <td style={{ ...summaryCell, fontSize: isImageCapture ? "15px" : "14px" }}>
                  <div style={tableTextCenter}>បានបង់/Paid</div>
                </td>

                <td style={{ ...summaryCell, fontSize: isImageCapture ? "18px" : "17px" }}>
                  <div style={tableTextCenter}>
                    {paidAmount > 0 ? formatRiel(paidAmount) : ""}
                  </div>
                </td>
              </tr>

              <tr style={{ height: summaryRowHeight }}>
                <td style={{ ...summaryCell, fontSize: isImageCapture ? "15px" : "14px" }}>
                  <div style={tableTextCenter}>នៅសល់/Balance</div>
                </td>

                <td style={{ ...summaryCell, fontSize: isImageCapture ? "18px" : "17px" }}>
                  <div style={tableTextCenter}>
                    {balanceAmount > 0 ? formatRiel(balanceAmount) : ""}
                  </div>
                </td>
              </tr>

              <tr style={{ height: summaryRowHeight }}>
                <td style={{ ...summaryCell, fontSize: isImageCapture ? "15px" : "14px" }}>
                  <div style={tableTextCenter}>ស្ថានភាព</div>
                </td>

                <td
                  style={{
                    ...summaryCell,
                    color: paymentColor,
                    fontSize: isImageCapture ? "19px" : "18px",
                  }}
                >
                  <div style={tableTextCenter}>{paymentLabel}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export default PrintInvoice;
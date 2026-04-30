import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import api from "../api";
import PrintInvoice from "../components/PrintInvoice";


const INITIAL_FILTERS = {
  search: "",
  selectedProductId: "all",
  paymentStatus: "all",
  invoiceType: "normal",
  dateFrom: "",
  dateTo: "",
};

const INITIAL_PAYMENT_FORM = {
  amount: "",
  payment_method: "cash",
  note: "",
};

const VISIBLE_STEP = 5;
const INITIAL_VISIBLE_COUNT = 10;
const MAX_SELECTED_INVOICES = 10;

function formatRiel(value) {
  return `${Number(value || 0).toLocaleString()} រៀល`;
}

function formatDateTime(date) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatKg(kg) {
  const value = Number(kg || 0);
  if (value >= 1000) return `${(value / 1000).toLocaleString()} តោន`;
  return `${value.toLocaleString()} គីឡូ`;
}

function paymentLabel(method) {
  return method === "qr" ? "QR" : "សាច់ប្រាក់";
}

function paymentStatusLabel(status) {
  if (status === "paid") return "បានទូទាត់";
  if (status === "debt") return "ជំពាក់";
  return "មិនទាន់ទូទាត់";
}

function getProductKhmerName(product) {
  const typeMap = {
    A: "ការ៉ុត",
    B: "បាកាន",
    C: "សំបកក្រហមស",
  };

  const typeName =
    typeMap[String(product?.type || "").toUpperCase()] || product?.type || "-";

  return `${typeName} - លេខ ${product?.grade || "-"}`;
}

function getPaymentAmount(payment) {
  return Number(
    payment?.amount ??
    payment?.paid_amount ??
    payment?.payment_amount ??
    payment?.deposit_amount ??
    0
  );
}

function getSortedPayments(sale) {
  return [...(sale?.payments || [])].sort((a, b) => {
    return new Date(b.created_at || 0) - new Date(a.created_at || 0);
  });
}

function getPaidAmount(sale) {
  if (sale?.paid_amount !== undefined && sale?.paid_amount !== null) {
    return Number(sale.paid_amount || 0);
  }

  if (Array.isArray(sale?.payments) && sale.payments.length > 0) {
    return sale.payments.reduce((sum, payment) => {
      return sum + getPaymentAmount(payment);
    }, 0);
  }

  if (sale?.deposit_amount !== undefined && sale?.deposit_amount !== null) {
    return Number(sale.deposit_amount || 0);
  }

  return sale?.payment_status === "paid" ? Number(sale.total_amount || 0) : 0;
}

function getBalanceAmount(sale) {
  if (sale?.balance_amount !== undefined && sale?.balance_amount !== null) {
    return Number(sale.balance_amount || 0);
  }

  if (sale?.balance !== undefined && sale?.balance !== null) {
    return Number(sale.balance || 0);
  }

  return Math.max(Number(sale?.total_amount || 0) - getPaidAmount(sale), 0);
}

function calculatePaymentStatus(total, paid) {
  const totalAmount = Number(total || 0);
  const paidAmount = Number(paid || 0);

  if (paidAmount <= 0) return "unpaid";
  if (paidAmount >= totalAmount) return "paid";
  return "debt";
}

function normalizePaymentStatus(sale) {
  if (sale?.payment_status === "paid") return "paid";
  if (sale?.payment_status === "debt") return "debt";
  if (sale?.payment_status === "unpaid") return "unpaid";

  return calculatePaymentStatus(sale?.total_amount, getPaidAmount(sale));
}

function parseMoneyInput(value) {
  return String(value || "").replace(/[^\d]/g, "");
}

function formatMoneyInput(value) {
  const raw = parseMoneyInput(value);
  if (!raw) return "";
  return Number(raw).toLocaleString();
}

function isMergedInvoice(sale) {
  return (
    sale?.invoice_no?.startsWith("MERGE-") ||
    sale?.merged_from ||
    sale?.note?.toLowerCase?.().includes("merged from")
  );
}

function getSaleMatchedItems(sale, selectedProductId) {
  const items = sale.items || [];

  if (selectedProductId === "all") return items;

  return items.filter(
    (item) => String(item.product_id) === String(selectedProductId)
  );
}

function getSaleDisplayData(sale, selectedProductId) {
  const matchedItems = getSaleMatchedItems(sale, selectedProductId);
  const firstItem = matchedItems[0];

  const totalQty = matchedItems.reduce(
    (sum, item) => sum + Number(item.quantity_kg || 0),
    0
  );

  const totalAmount =
    selectedProductId === "all"
      ? sale.total_amount
      : matchedItems.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);

  return {
    firstItem,
    itemCount: matchedItems.length,
    totalQty,
    totalAmount,
    paidAmount: getPaidAmount(sale),
    balanceAmount: getBalanceAmount(sale),
    status: normalizePaymentStatus(sale),
    paymentCount: sale.payments?.length || 0,
  };
}

function SummaryCards({ sale, styles }) {
  const status = normalizePaymentStatus(sale);

  return (
    <div style={styles.paymentPreview}>
      <div style={styles.previewItem}>
        <span>សរុប</span>
        <strong>{formatRiel(sale.total_amount)}</strong>
      </div>
      <div style={styles.previewItem}>
        <span>បានបង់</span>
        <strong>{formatRiel(getPaidAmount(sale))}</strong>
      </div>
      <div style={styles.previewItem}>
        <span>នៅសល់</span>
        <strong>{formatRiel(getBalanceAmount(sale))}</strong>
      </div>
      <div style={styles.previewItem}>
        <span>ស្ថានភាព</span>
        <strong>{paymentStatusLabel(status)}</strong>
      </div>
    </div>
  );
}

export default function Sales() {

  const [deleteSale, setDeleteSale] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const tableRef = useRef(null);
  const imageInvoiceRef = useRef(null);

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const [selectedSaleIds, setSelectedSaleIds] = useState([]);

  const [printSale, setPrintSale] = useState(null);
  const [imageSale, setImageSale] = useState(null);
  const [savingImageId, setSavingImageId] = useState(null);

  const [editSale, setEditSale] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [historySale, setHistorySale] = useState(null);
  const [addPaymentSale, setAddPaymentSale] = useState(null);
  const [addPaymentForm, setAddPaymentForm] = useState(INITIAL_PAYMENT_FORM);
  const [savingPayment, setSavingPayment] = useState(false);

  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePaidAmount, setMergePaidAmount] = useState("");
  const [merging, setMerging] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900);

  const isDark = document.documentElement.classList.contains("dark");
  const styles = getStyles(isDark, isMobile);

  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth < 900);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    function handleEsc(e) {
      if (e.key === "Escape") {
        setHistorySale(null);
        setAddPaymentSale(null);
        setEditSale(null);
        setMergeOpen(false);
      }
    }

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    fetchSales();
    fetchProducts();
  }, []);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setSelectedSaleIds([]);
  }, [filters]);

  async function fetchSales() {
    const res = await api.get("/sales");
    setSales(Array.isArray(res.data) ? res.data : res.data.data || []);
  }

  async function fetchProducts() {
    const res = await api.get("/products");
    setProducts(Array.isArray(res.data) ? res.data : res.data.data || []);
  }
  async function confirmDeleteSale() {
    if (!deleteSale) return;

    setDeleting(true);

    try {
      await api.delete(`/sales/${deleteSale.id}`);

      setSales((prev) => prev.filter((s) => s.id !== deleteSale.id));

      setDeleteSale(null);
    } catch (err) {
      console.error(err);
      alert("លុបវិក្កយបត្រមិនបានទេ");
    } finally {
      setDeleting(false);
    }
  }
  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(INITIAL_FILTERS);
    setVisibleCount(INITIAL_VISIBLE_COUNT);
    setSelectedSaleIds([]);
  }

  function updateSaleInState(updatedSale) {
    setSales((prev) =>
      prev.map((sale) => (sale.id === updatedSale.id ? updatedSale : sale))
    );

    setHistorySale((prev) => (prev?.id === updatedSale.id ? updatedSale : prev));

    setAddPaymentSale((prev) =>
      prev?.id === updatedSale.id ? updatedSale : prev
    );
  }

  function scrollTable(direction) {
    if (!tableRef.current) return;

    tableRef.current.scrollTo({
      left: direction === "left" ? 0 : tableRef.current.scrollWidth,
      behavior: "smooth",
    });
  }

  function handlePrint(sale) {
    setPrintSale(sale);
    setTimeout(() => window.print(), 100);
  }

  async function handleSaveImage(sale) {
    if (savingImageId) return;

    setImageSale(sale);
    setSavingImageId(sale.id);

    try {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await document.fonts.ready;

      const target =
        imageInvoiceRef.current?.querySelector(".heng-huy-print") ||
        imageInvoiceRef.current;

      if (!target) {
        alert("រក្សាទុករូបភាពមិនបានទេ។");
        return;
      }

      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: target.offsetWidth,
        height: target.offsetHeight,
        windowWidth: target.offsetWidth,
        windowHeight: target.offsetHeight,
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          alert("រក្សាទុករូបភាពមិនបានទេ។");
          return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `${sale.invoice_no || "invoice"}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch (error) {
      console.error("Save invoice image error:", error);
      alert("រក្សាទុករូបភាពមិនបានទេ។");
    } finally {
      setSavingImageId(null);
    }
  }

  function toggleSelectSale(saleId) {
    setSelectedSaleIds((prev) => {
      if (prev.includes(saleId)) return prev.filter((id) => id !== saleId);

      if (prev.length >= MAX_SELECTED_INVOICES) {
        alert(`អាចជ្រើសបានច្រើនបំផុតត្រឹម ${MAX_SELECTED_INVOICES} វិក្កយបត្រ`);
        return prev;
      }

      return [...prev, saleId];
    });
  }

  function openEdit(sale) {
    setEditSale({
      ...sale,
      customer_name: sale.customer?.name || "",
      customer_phone: sale.customer?.phone || "",
      payment_method: sale.payment_method || "cash",
    });
  }

  async function saveEdit() {
    if (!editSale) return;

    setSavingEdit(true);

    try {
      const payload = {
        customer_name: editSale.customer_name,
        customer_phone: editSale.customer_phone,
        payment_method: editSale.payment_method,
      };

      const res = await api.put(`/sales/${editSale.id}`, payload);
      updateSaleInState(res.data);
      setEditSale(null);
    } catch (error) {
      alert("កែប្រែវិក្កយបត្រមិនបានទេ។ សូមពិនិត្យ backend route PUT /sales/{id}");
    } finally {
      setSavingEdit(false);
    }
  }

  function openPaymentHistory(sale) {
    setHistorySale(sale);
  }

  function openAddPayment(sale) {
    const balance = getBalanceAmount(sale);

    setAddPaymentSale(sale);
    setAddPaymentForm({
      amount: balance > 0 ? String(balance) : "",
      payment_method: sale.payment_method || "cash",
      note: "",
    });
  }

  function clearAddPaymentForm() {
    setAddPaymentForm(INITIAL_PAYMENT_FORM);
  }

  async function saveAdditionalPayment() {
    if (!addPaymentSale) return;

    const amount = Number(addPaymentForm.amount || 0);
    const balance = getBalanceAmount(addPaymentSale);

    if (amount <= 0) {
      alert("សូមបញ្ចូលចំនួនប្រាក់ត្រឹមត្រូវ");
      return;
    }

    if (amount > balance) {
      alert("ចំនួនប្រាក់បង់មិនអាចលើសប្រាក់នៅសល់បានទេ");
      return;
    }

    setSavingPayment(true);

    try {
      const res = await api.post(`/sales/${addPaymentSale.id}/payments`, {
        amount,
        payment_method: addPaymentForm.payment_method,
        note: addPaymentForm.note || "Additional payment",
      });

      if (res.data?.id) {
        updateSaleInState(res.data);
      } else {
        await fetchSales();
      }

      setAddPaymentSale(null);
      setAddPaymentForm(INITIAL_PAYMENT_FORM);
    } catch (error) {
      alert(
        "បន្ថែមប្រាក់បង់មិនបានទេ។ សូមពិនិត្យ backend route POST /sales/{id}/payments"
      );
    } finally {
      setSavingPayment(false);
    }
  }

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const keyword = filters.search.toLowerCase();

      const matchesSearch =
        !keyword ||
        sale.invoice_no?.toLowerCase().includes(keyword) ||
        sale.customer?.name?.toLowerCase().includes(keyword) ||
        sale.customer?.phone?.toLowerCase().includes(keyword);

      const matchesProduct =
        filters.selectedProductId === "all" ||
        (sale.items || []).some(
          (item) => String(item.product_id) === String(filters.selectedProductId)
        );

      const matchesPaymentStatus =
        filters.paymentStatus === "all" ||
        normalizePaymentStatus(sale) === filters.paymentStatus;

      const merged = isMergedInvoice(sale);

      const matchesInvoiceType =
        filters.invoiceType === "all" ||
        (filters.invoiceType === "normal" && !merged) ||
        (filters.invoiceType === "merged" && merged);

      const saleDate = sale.created_at ? new Date(sale.created_at) : null;

      const matchesDateFrom =
        !filters.dateFrom ||
        (saleDate && saleDate >= new Date(`${filters.dateFrom}T00:00:00`));

      const matchesDateTo =
        !filters.dateTo ||
        (saleDate && saleDate <= new Date(`${filters.dateTo}T23:59:59`));

      return (
        matchesSearch &&
        matchesProduct &&
        matchesPaymentStatus &&
        matchesInvoiceType &&
        matchesDateFrom &&
        matchesDateTo
      );
    });
  }, [sales, filters]);

  const visibleSales = filteredSales.slice(0, visibleCount);
  const hasMore = visibleCount < filteredSales.length;

  const selectedSales = useMemo(() => {
    return sales.filter((sale) => selectedSaleIds.includes(sale.id));
  }, [sales, selectedSaleIds]);

  const selectedCustomerIds = useMemo(() => {
    return [...new Set(selectedSales.map((sale) => sale.customer_id))];
  }, [selectedSales]);

  const canMergeSelected =
    selectedSales.length >= 2 && selectedCustomerIds.length === 1;

  const mergeTotal = selectedSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );

  const mergePaidRaw = Number(mergePaidAmount || 0);
  const mergeBalance = Math.max(mergeTotal - mergePaidRaw, 0);
  const mergePaymentStatus = calculatePaymentStatus(mergeTotal, mergePaidRaw);

  function buildMergedInvoice() {
    const firstSale = selectedSales[0];

    const mergedItems = selectedSales.flatMap((sale) =>
      (sale.items || []).map((item) => ({
        ...item,
        invoice_no: sale.invoice_no,
      }))
    );

    return {
      id: `merged-${Date.now()}`,
      invoice_no: `MERGE-${new Date().getTime()}`,
      customer: firstSale?.customer || null,
      customer_id: firstSale?.customer_id || null,
      items: mergedItems,
      total_amount: mergeTotal,
      paid_amount: mergePaidRaw,
      deposit_amount: mergePaidRaw,
      balance_amount: mergeBalance,
      payment_method: firstSale?.payment_method || "cash",
      payment_status: mergePaymentStatus,
      created_at: new Date().toISOString(),
      merged_from: selectedSales.map((sale) => sale.invoice_no),
    };
  }

  function openMergeModal() {
    if (!canMergeSelected) {
      alert("មិនអាចបញ្ចូលវិក្កយបត្រអតិថិជនខុសគ្នាបានទេ");
      return;
    }

    const defaultPaid = selectedSales.reduce(
      (sum, sale) => sum + getPaidAmount(sale),
      0
    );

    setMergePaidAmount(String(defaultPaid));
    setMergeOpen(true);
  }

  async function handleMergeSaveImageOnly() {
    if (selectedSales.length < 2) {
      alert("សូមជ្រើសយ៉ាងតិច 2 វិក្កយបត្រ ដើម្បីរក្សាទុករូបភាព");
      return;
    }

    const mergedInvoice = buildMergedInvoice();
    await handleSaveImage(mergedInvoice);
    setMergeOpen(false);
  }

  async function handleMergePrintOnly() {
    if (selectedSales.length < 2) {
      alert("សូមជ្រើសយ៉ាងតិច 2 វិក្កយបត្រ ដើម្បីបញ្ចូលគ្នា");
      return;
    }

    const mergedInvoice = buildMergedInvoice();
    handlePrint(mergedInvoice);
    setMergeOpen(false);
  }

  async function handleMergeSaveAndPrint() {
    if (selectedSales.length < 2) {
      alert("សូមជ្រើសយ៉ាងតិច 2 វិក្កយបត្រ ដើម្បីបញ្ចូលគ្នា");
      return;
    }

    setMerging(true);

    try {
      const res = await api.post("/sales/merge", {
        sale_ids: selectedSaleIds,
        paid_amount: mergePaidRaw,
      });

      await fetchSales();
      setSelectedSaleIds([]);
      setMergeOpen(false);
      handlePrint(res.data);
    } catch (error) {
      alert("រក្សាទុកវិក្កយបត្របញ្ចូលគ្នាមិនបានទេ។ សូមបង្កើត backend route POST /sales/merge");
    } finally {
      setMerging(false);
    }
  }

  const hasActiveFilters =
    filters.search ||
    filters.selectedProductId !== "all" ||
    filters.paymentStatus !== "all" ||
    filters.invoiceType !== "normal" ||
    filters.dateFrom ||
    filters.dateTo;

  return (
    <>
      <main className="print:hidden" style={styles.page}>
        <div style={styles.wrap}>
          <div style={styles.topBar}>
            <div>
              <h1 style={styles.title}>ប្រវត្តិលក់</h1>
              <p style={styles.subtitle}>បង្ហាញវិក្កយបត្រលក់ទាំងអស់</p>
            </div>
          </div>

          <div style={styles.filters}>
            <input
              placeholder="ស្វែងរកតាមឈ្មោះ លេខទូរស័ព្ទ ឬលេខវិក្កយបត្រ..."
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              style={styles.search}
            />

            <select
              value={filters.selectedProductId}
              onChange={(e) => updateFilter("selectedProductId", e.target.value)}
              style={styles.select}
            >
              <option value="all">ផលិតផលទាំងអស់</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {getProductKhmerName(product)}
                </option>
              ))}
            </select>

            <select
              value={filters.paymentStatus}
              onChange={(e) => updateFilter("paymentStatus", e.target.value)}
              style={styles.statusSelect}
            >
              <option value="all">ការទូទាត់ទាំងអស់</option>
              <option value="paid">បានទូទាត់</option>
              <option value="unpaid">មិនទាន់ទូទាត់</option>
              <option value="debt">ជំពាក់</option>
            </select>

            <select
              value={filters.invoiceType}
              onChange={(e) => updateFilter("invoiceType", e.target.value)}
              style={styles.statusSelect}
            >
              <option value="normal">វិក្កយបត្រធម្មតា</option>
              <option value="merged">វិក្កយបត្រសរុប</option>
              <option value="all">ទាំងអស់</option>
            </select>

            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateFilter("dateFrom", e.target.value)}
              style={styles.date}
            />

            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateFilter("dateTo", e.target.value)}
              style={styles.date}
            />

            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} style={styles.clearBtn}>
                សម្អាត
              </button>
            )}
          </div>

          {selectedSaleIds.length > 0 && (
            <div style={styles.selectedStickyBar}>
              <div style={styles.selectedBox}>
                <span style={styles.selectedText}>
                  បានជ្រើស {selectedSaleIds.length} / 10
                </span>

                <button
                  type="button"
                  onClick={() => setSelectedSaleIds([])}
                  style={styles.clearSmallBtn}
                >
                  ដោះជ្រើស
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!canMergeSelected) {
                      alert("មិនអាចបញ្ចូលវិក្កយបត្រអតិថិជនខុសគ្នាបានទេ");
                      return;
                    }

                    const defaultPaid = selectedSales.reduce(
                      (sum, sale) => sum + getPaidAmount(sale),
                      0
                    );

                    setMergePaidAmount(defaultPaid);
                    setMergeOpen(true);
                  }}
                  disabled={!canMergeSelected}
                  style={{
                    ...styles.mergeBtn,
                    opacity: !canMergeSelected ? 0.55 : 1,
                    cursor: !canMergeSelected ? "not-allowed" : "pointer",
                  }}
                >
                  បញ្ចូលវិក្កយបត្រ
                </button>
              </div>
            </div>
          )}

          <div style={styles.desktopOnly}>
            <div style={styles.scrollControls}>
              <button onClick={() => scrollTable("left")} style={styles.scrollBtn}>
                ‹
              </button>
              <button onClick={() => scrollTable("right")} style={styles.scrollBtn}>
                ›
              </button>
            </div>

            <div style={styles.card}>
              <div style={styles.tableWrap} ref={tableRef}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.headRow}>
                      <th style={styles.th}>ជ្រើស</th>
                      <th style={styles.th}>លេខវិក្កយបត្រ</th>
                      <th style={styles.th}>អតិថិជន</th>
                      <th style={styles.th}>ទូរស័ព្ទ</th>
                      <th style={styles.th}>ផលិតផល</th>
                      <th style={styles.th}>បរិមាណ</th>
                      <th style={styles.th}>សរុប</th>
                      <th style={styles.th}>បានបង់</th>
                      <th style={styles.th}>នៅសល់</th>
                      <th style={styles.th}>វិធីបង់ប្រាក់</th>
                      <th style={styles.th}>ស្ថានភាព</th>
                      <th style={styles.th}>ប្រវត្តិបង់</th>
                      <th style={styles.th}>កាលបរិច្ឆេទ</th>
                      <th style={{ ...styles.th, textAlign: "right" }}>សកម្មភាព</th>
                    </tr>
                  </thead>

                  <tbody>
                    {visibleSales.map((sale) => {
                      const display = getSaleDisplayData(
                        sale,
                        filters.selectedProductId
                      );
                      const selected = selectedSaleIds.includes(sale.id);

                      return (
                        <tr key={sale.id} style={styles.bodyRow}>
                          <td style={styles.td}>
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleSelectSale(sale.id)}
                              style={styles.checkbox}
                            />
                          </td>

                          <td style={styles.tdStrong}>{sale.invoice_no}</td>
                          <td style={styles.td}>{sale.customer?.name || "—"}</td>
                          <td style={styles.td}>{sale.customer?.phone || "—"}</td>

                          <td style={styles.td}>
                            {display.firstItem?.product
                              ? getProductKhmerName(display.firstItem.product)
                              : "—"}
                            {display.itemCount > 1 ? ` +${display.itemCount - 1}` : ""}
                          </td>

                          <td style={styles.td}>
                            {display.totalQty ? formatKg(display.totalQty) : "—"}
                          </td>

                          <td style={styles.tdStrong}>
                            {formatRiel(display.totalAmount)}
                          </td>
                          <td style={styles.tdStrong}>
                            {formatRiel(display.paidAmount)}
                          </td>
                          <td style={styles.tdStrong}>
                            {formatRiel(display.balanceAmount)}
                          </td>
                          <td style={styles.td}>{paymentLabel(sale.payment_method)}</td>

                          <td style={styles.td}>
                            <StatusBadge status={display.status} styles={styles} />
                          </td>

                          <td style={styles.td}>
                            <button
                              type="button"
                              onClick={() => openPaymentHistory(sale)}
                              style={styles.historyBtn}
                            >
                              មើល {display.paymentCount > 0 ? `(${display.paymentCount})` : ""}
                            </button>
                          </td>

                          <td style={styles.td}>{formatDateTime(sale.created_at)}</td>

                          <td style={{ ...styles.td, textAlign: "right" }}>
                            <div style={styles.actionGroup}>
                              {display.status !== "paid" && (
                                <button
                                  type="button"
                                  onClick={() => openAddPayment(sale)}
                                  style={styles.payBtn}
                                >
                                  បង់ប្រាក់
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openEdit(sale)}
                                style={styles.editBtn}
                              >
                                កែ
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteSale(sale)}
                                style={styles.deleteBtn}
                              >
                                លុប
                              </button>

                              <button
                                type="button"
                                onClick={() => handlePrint(sale)}
                                style={styles.printBtn}
                              >
                                មើល / បោះពុម្ព
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSaveImage(sale)}
                                disabled={savingImageId === sale.id}
                                style={styles.imageBtn}
                              >
                                {savingImageId === sale.id
                                  ? "កំពុងរក្សាទុក..."
                                  : "រក្សាទុករូបភាព"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredSales.length === 0 && (
                      <tr>
                        <td colSpan="14" style={styles.empty}>
                          មិនមានទិន្នន័យ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={styles.mobileOnly}>
            {visibleSales.map((sale) => {
              const display = getSaleDisplayData(sale, filters.selectedProductId);
              const selected = selectedSaleIds.includes(sale.id);

              return (
                <SaleMobileCard
                  key={sale.id}
                  sale={sale}
                  display={display}
                  selected={selected}
                  styles={styles}
                  toggleSelectSale={toggleSelectSale}
                  openPaymentHistory={openPaymentHistory}
                  openAddPayment={openAddPayment}
                  openEdit={openEdit}
                  handlePrint={handlePrint}
                  handleSaveImage={handleSaveImage}
                  savingImageId={savingImageId}
                />
              );
            })}

            {filteredSales.length === 0 && (
              <div style={styles.mobileEmpty}>មិនមានទិន្នន័យ</div>
            )}
          </div>

          {filteredSales.length > 0 && (
            <div style={styles.moreWrap}>
              <p style={styles.countText}>
                បង្ហាញ {Math.min(visibleCount, filteredSales.length)} / {filteredSales.length}
              </p>

              {hasMore && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + VISIBLE_STEP)}
                  style={styles.moreBtn}
                >
                  មើលបន្ថែម {VISIBLE_STEP}
                </button>
              )}
            </div>
          )}
        </div>
      </main>

      {historySale && (
        <div
          className="print:hidden"
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setHistorySale(null);
            }
          }}
        >
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>ប្រវត្តិបង់ប្រាក់</h2>
                <p style={styles.modalSub}>
                  វិក្កយបត្រ៖ <strong>{historySale.invoice_no}</strong>
                </p>
              </div>

              {normalizePaymentStatus(historySale) !== "paid" && (
                <button
                  type="button"
                  onClick={() => openAddPayment(historySale)}
                  style={styles.payBtn}
                >
                  បន្ថែមប្រាក់បង់
                </button>
              )}
            </div>

            <SummaryCards sale={historySale} styles={styles} />

            <div style={styles.historyList}>
              {getSortedPayments(historySale).length > 0 ? (
                getSortedPayments(historySale).map((payment, index) => (
                  <div key={payment.id || index} style={styles.historyRow}>
                    <div style={styles.historyNumber}>លើកទី {index + 1}</div>

                    <div style={styles.historyInfo}>
                      <strong>{formatRiel(getPaymentAmount(payment))}</strong>
                      <span>{paymentLabel(payment.payment_method)}</span>
                      {payment.note ? <small>{payment.note}</small> : null}
                    </div>

                    <div style={styles.historyDate}>
                      {formatDateTime(payment.created_at)}
                    </div>
                  </div>
                ))
              ) : (
                <div style={styles.noHistory}>
                  មិនទាន់មានប្រវត្តិបង់ប្រាក់លម្អិត
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setHistorySale(null)}
                style={styles.cancelBtn}
              >
                បិទ
              </button>
            </div>
          </div>
        </div>
      )}

      {addPaymentSale && (
        <div
          className="print:hidden"
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setAddPaymentSale(null);
            }
          }}
        >
          <div style={styles.modalSmall}>
            <h2 style={styles.modalTitle}>បន្ថែមប្រាក់បង់</h2>
            <p style={styles.modalSub}>
              វិក្កយបត្រ៖ <strong>{addPaymentSale.invoice_no}</strong>
            </p>

            <div style={styles.paymentPreview}>
              <div style={styles.previewItem}>
                <span>បានបង់</span>
                <strong>{formatRiel(getPaidAmount(addPaymentSale))}</strong>
              </div>
              <div style={styles.previewItem}>
                <span>នៅសល់</span>
                <strong>{formatRiel(getBalanceAmount(addPaymentSale))}</strong>
              </div>
            </div>

            <div style={styles.formGrid}>
              <label style={styles.label}>
                ចំនួនប្រាក់បង់
                <input
                  inputMode="numeric"
                  value={formatMoneyInput(addPaymentForm.amount)}
                  onChange={(e) =>
                    setAddPaymentForm((prev) => ({
                      ...prev,
                      amount: parseMoneyInput(e.target.value),
                    }))
                  }
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                វិធីបង់ប្រាក់
                <select
                  value={addPaymentForm.payment_method}
                  onChange={(e) =>
                    setAddPaymentForm((prev) => ({
                      ...prev,
                      payment_method: e.target.value,
                    }))
                  }
                  style={styles.input}
                >
                  <option value="cash">សាច់ប្រាក់</option>
                  <option value="qr">QR</option>
                </select>
              </label>

              <label style={{ ...styles.label, gridColumn: "1 / -1" }}>
                កំណត់ចំណាំ
                <input
                  value={addPaymentForm.note}
                  onChange={(e) =>
                    setAddPaymentForm((prev) => ({
                      ...prev,
                      note: e.target.value,
                    }))
                  }
                  placeholder="ឧ. បង់បន្ថែមលើកទី 2"
                  style={styles.input}
                />
              </label>
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={clearAddPaymentForm}
                style={styles.clearModalBtn}
              >
                សម្អាត
              </button>

              <button
                type="button"
                onClick={() => setAddPaymentSale(null)}
                style={styles.cancelBtn}
              >
                បោះបង់
              </button>

              <button
                type="button"
                onClick={saveAdditionalPayment}
                disabled={savingPayment}
                style={styles.saveBtn}
              >
                {savingPayment ? "កំពុងរក្សាទុក..." : "រក្សាទុកប្រាក់បង់"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editSale && (
        <div
          className="print:hidden"
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setEditSale(null);
            }
          }}
        >
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>កែវិក្កយបត្រ</h2>

            <SummaryCards sale={editSale} styles={styles} />

            <div style={styles.formGrid}>
              <label style={styles.label}>
                ឈ្មោះអតិថិជន
                <input
                  value={editSale.customer_name}
                  onChange={(e) =>
                    setEditSale((prev) => ({
                      ...prev,
                      customer_name: e.target.value,
                    }))
                  }
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                លេខទូរស័ព្ទ
                <input
                  value={editSale.customer_phone}
                  onChange={(e) =>
                    setEditSale((prev) => ({
                      ...prev,
                      customer_phone: e.target.value,
                    }))
                  }
                  style={styles.input}
                />
              </label>

              <label style={styles.label}>
                វិធីបង់ប្រាក់
                <select
                  value={editSale.payment_method}
                  onChange={(e) =>
                    setEditSale((prev) => ({
                      ...prev,
                      payment_method: e.target.value,
                    }))
                  }
                  style={styles.input}
                >
                  <option value="cash">សាច់ប្រាក់</option>
                  <option value="qr">QR</option>
                </select>
              </label>
            </div>

            <p style={styles.logicNote}>
              ការកែប្រែនេះសម្រាប់ព័ត៌មានអតិថិជន និងវិធីបង់ប្រាក់ប៉ុណ្ណោះ។
              ចំនួនប្រាក់បានបង់ត្រូវបន្ថែមតាមប៊ូតុង “បង់ប្រាក់” ដើម្បីរក្សាប្រវត្តិឱ្យត្រឹមត្រូវ។
            </p>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setEditSale(null)}
                style={styles.cancelBtn}
              >
                បោះបង់
              </button>

              <button
                type="button"
                onClick={saveEdit}
                disabled={savingEdit}
                style={styles.saveBtn}
              >
                {savingEdit ? "កំពុងរក្សាទុក..." : "រក្សាទុក"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mergeOpen && (
        <div
          className="print:hidden"
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setMergeOpen(false);
            }
          }}
        >
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>បញ្ចូលវិក្កយបត្រ</h2>
            <p style={styles.mergeDesc}>
              បានជ្រើស {selectedSales.length} វិក្កយបត្រ។ សរុបថ្មី៖{" "}
              <strong>{formatRiel(mergeTotal)}</strong>
            </p>

            <div style={styles.mergeSummary}>
              <div style={styles.mergeItem}>
                <span>សរុប</span>
                <strong>{formatRiel(mergeTotal)}</strong>
              </div>
              <div style={styles.mergeItem}>
                <span>បានបង់</span>
                <strong>{formatRiel(mergePaidRaw)}</strong>
              </div>
              <div style={styles.mergeItem}>
                <span>នៅសល់</span>
                <strong>{formatRiel(mergeBalance)}</strong>
              </div>
              <div style={styles.mergeItem}>
                <span>ស្ថានភាព</span>
                <strong>{paymentStatusLabel(mergePaymentStatus)}</strong>
              </div>
            </div>

            <div style={{ ...styles.readOnlyPaymentBox, marginTop: 18 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <small>
                  {selectedSales.map((s) => (
                    <div key={s.id}>
                      {s.invoice_no} = {formatRiel(getPaidAmount(s))}
                    </div>
                  ))}
                </small>
              </div>

              <strong>{formatRiel(mergePaidAmount)}</strong>
            </div>

            <div style={styles.selectedInvoices}>
              {selectedSales.map((sale) => (
                <div key={sale.id} style={styles.selectedInvoiceRow}>
                  <span>{sale.invoice_no}</span>
                  <strong>{formatRiel(sale.total_amount)}</strong>
                </div>
              ))}
            </div>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setMergeOpen(false)}
                style={styles.cancelBtn}
              >
                បោះបង់
              </button>

              <button
                type="button"
                onClick={handleMergeSaveImageOnly}
                style={styles.imageBtn}
              >
                រក្សាទុករូបភាព
              </button>

              <button
                type="button"
                onClick={handleMergePrintOnly}
                style={styles.printOnlyBtn}
              >
                បោះពុម្ពប៉ុណ្ណោះ
              </button>

              <button
                type="button"
                onClick={handleMergeSaveAndPrint}
                disabled={merging}
                style={styles.saveBtn}
              >
                {merging ? "កំពុងបញ្ចូល..." : "រក្សាទុក + បោះពុម្ព"}
              </button>
            </div>
          </div>
        </div>
      )}

      {printSale && <PrintInvoice invoice={printSale} />}
      {imageSale && (
        <PrintInvoice
          ref={imageInvoiceRef}
          invoice={imageSale}
          captureMode={true}
        />
      )}
      {deleteSale && (
        <div
          className="print:hidden"
          style={styles.modalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteSale(null);
            }
          }}
        >
          <div style={styles.modalSmall}>
            <h2 style={styles.modalTitle}>លុបវិក្កយបត្រ</h2>

            <p style={styles.modalSub}>
              តើអ្នកពិតជាចង់លុប{" "}
              <strong>{deleteSale.invoice_no}</strong> មែនទេ?
            </p>

            <p style={{ ...styles.logicNote, marginTop: 10 }}>
              ⚠️ Stock នឹងត្រឡប់វិញ និងប្រាក់ចំណូលនឹងត្រូវដកចេញ
            </p>

            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setDeleteSale(null)}
                style={styles.cancelBtn}
              >
                បោះបង់
              </button>

              <button
                type="button"
                onClick={confirmDeleteSale}
                disabled={deleting}
                style={{
                  ...styles.saveBtn,
                  background: "#dc2626",
                }}
              >
                {deleting ? "កំពុងលុប..." : "លុប"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status, styles }) {
  return (
    <span
      style={{
        ...styles.statusBadge,
        ...(status === "paid"
          ? styles.paidBadge
          : status === "debt"
            ? styles.debtBadge
            : styles.unpaidBadge),
      }}
    >
      {paymentStatusLabel(status)}
    </span>
  );
}

function SaleMobileCard({
  sale,
  display,
  selected,
  styles,
  toggleSelectSale,
  openPaymentHistory,
  openAddPayment,
  openEdit,
  handlePrint,
  handleSaveImage,
  savingImageId,
}) {
  return (
    <div style={styles.mobileInvoiceCard}>
      <div style={styles.mobileInvoiceTop}>
        <div style={styles.mobileInvoiceHeaderText}>
          <p style={styles.mobileInvoiceNo}>{sale.invoice_no}</p>
          <p style={styles.mobileDate}>{formatDateTime(sale.created_at)}</p>
        </div>

        <StatusBadge status={display.status} styles={styles} />
      </div>

      <div style={styles.mobileCustomerBox}>
        <div style={styles.mobileInfoItem}>
          <span style={styles.mobileLabel}>អតិថិជន</span>
          <strong style={styles.mobileValue}>{sale.customer?.name || "—"}</strong>
        </div>

        <div style={styles.mobileInfoItem}>
          <span style={styles.mobileLabel}>ទូរស័ព្ទ</span>
          <strong style={styles.mobileValue}>{sale.customer?.phone || "—"}</strong>
        </div>
      </div>

      <div style={styles.mobileProductBox}>
        <span style={styles.mobileLabel}>ផលិតផល</span>
        <strong style={styles.mobileValue}>
          {display.firstItem?.product
            ? getProductKhmerName(display.firstItem.product)
            : "—"}
          {display.itemCount > 1 ? ` +${display.itemCount - 1}` : ""}
        </strong>
        <span style={styles.mobileSubText}>
          {display.totalQty ? formatKg(display.totalQty) : "—"} · {paymentLabel(sale.payment_method)}
        </span>
      </div>

      <div style={styles.mobileMoneyGrid}>
        <div style={styles.mobileMoneyItem}>
          <span>សរុប</span>
          <strong>{formatRiel(display.totalAmount)}</strong>
        </div>
        <div style={styles.mobileMoneyItem}>
          <span>បានបង់</span>
          <strong>{formatRiel(display.paidAmount)}</strong>
        </div>
        <div
          style={{
            ...styles.mobileMoneyItem,
            ...(Number(display.balanceAmount || 0) > 0 ? styles.mobileDebtMoney : {}),
          }}
        >
          <span>នៅសល់</span>
          <strong>{formatRiel(display.balanceAmount)}</strong>
        </div>
      </div>

      <div style={styles.mobileUtilityRow}>
        <label style={styles.mobileSelectCheck}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelectSale(sale.id)}
            style={styles.checkbox}
          />
          ជ្រើសបញ្ចូល
        </label>

        <button
          type="button"
          onClick={() => openPaymentHistory(sale)}
          style={styles.historyBtn}
        >
          ប្រវត្តិ {display.paymentCount > 0 ? `(${display.paymentCount})` : ""}
        </button>
      </div>

      <div style={styles.mobileActions}>
        {display.status !== "paid" && (
          <button
            type="button"
            onClick={() => openAddPayment(sale)}
            style={styles.payBtn}
          >
            បង់ប្រាក់
          </button>
        )}

        <button type="button" onClick={() => openEdit(sale)} style={styles.editBtn}>
          កែ
        </button>

        <button
          type="button"
          onClick={() => setDeleteSale(sale)}
          style={styles.deleteBtn}
        >
          លុប
        </button>

        <button
          type="button"
          onClick={() => handlePrint(sale)}
          style={styles.printBtn}
        >
          បោះពុម្ព
        </button>

        <button
          type="button"
          onClick={() => handleSaveImage(sale)}
          disabled={savingImageId === sale.id}
          style={styles.imageBtn}
        >
          {savingImageId === sale.id ? "កំពុងរក្សាទុក..." : "រូបភាព"}
        </button>
      </div>
    </div>
  );
}

function getStyles(isDark, isMobile) {
  return {
    desktopOnly: {
      display: isMobile ? "none" : "block",
    },
    mobileOnly: {
      display: isMobile ? "block" : "none",
      marginTop: 20,
    },
    selectedStickyBar: {
      position: "fixed",
      top: isMobile ? "auto" : 38,
      bottom: isMobile ? 16 : "auto",
      right: isMobile ? 16 : 38,
      left: isMobile ? 16 : "auto",
      zIndex: 45,
      width: "auto",
      padding: 0,
      display: "inline-flex",
      background: "transparent",
      pointerEvents: "none",
    },
    readOnlyPaymentBox: {
      minHeight: 56,
      borderRadius: 12,
      border: isDark ? "1px solid #334155" : "1px solid #d6ead8",
      padding: "10px 14px",
      background: isDark ? "#020617" : "#f8fafc",
      color: isDark ? "#f8fafc" : "#0f172a",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      fontWeight: 900,
    },
    imageBtn: {
      background: isDark ? "#1d4ed8" : "#2563eb",
      color: "white",
      border: "none",
      borderRadius: 10,
      padding: "9px 16px",
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    page: {
      minHeight: "100vh",
      background: isDark ? "#020617" : "#f7faf5",
      padding: isMobile ? "16px" : "32px",
      color: isDark ? "#f8fafc" : "#0f172a",
      transition: "background 0.2s ease, color 0.2s ease",
    },
    wrap: {
      maxWidth: 1500,
      margin: "0 auto",
    },
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 20,
      flexWrap: "wrap",
    },
    title: {
      fontSize: 32,
      fontWeight: 800,
      margin: 0,
      color: isDark ? "#ffffff" : "#0f172a",
    },
    subtitle: {
      color: isDark ? "#94a3b8" : "#64748b",
      marginTop: 6,
      fontSize: 16,
    },
    selectedBox: {
      display: "flex",
      pointerEvents: "auto",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 18,
      background: isDark
        ? "rgba(15, 23, 42, 0.78)"
        : "rgba(255, 255, 255, 0.9)",
      border: isDark
        ? "1px solid rgba(148, 163, 184, 0.28)"
        : "1px solid #d6ead8",
      boxShadow: isDark
        ? "0 18px 40px rgba(0, 0, 0, 0.28)"
        : "0 18px 40px rgba(15, 23, 42, 0.12)",
      backdropFilter: "blur(10px)",
      width: isMobile ? "100%" : "auto",
      justifyContent: isMobile ? "space-between" : "flex-start",
      flexWrap: isMobile ? "wrap" : "nowrap",
    },
    selectedText: {
      fontSize: 14,
      fontWeight: 900,
      color: isDark ? "#e2e8f0" : "#334155",
    },
    filters: {
      marginTop: 22,
      display: "flex",
      flexWrap: "wrap",
      gap: 14,
    },
    search: {
      flex: isMobile ? "1 1 100%" : "1 1 320px",
      height: 48,
      borderRadius: 12,
      border: isDark ? "1px solid #334155" : "1px solid #d6ead8",
      padding: "0 16px",
      fontSize: 16,
      outline: "none",
      boxSizing: "border-box",
      background: isDark ? "#0f172a" : "white",
      color: isDark ? "#f8fafc" : "#0f172a",
    },
    select: {
      flex: isMobile ? "1 1 calc(50% - 8px)" : "0 1 250px",
      height: 48,
      borderRadius: 12,
      border: isDark ? "1px solid #334155" : "1px solid #d6ead8",
      padding: "0 16px",
      fontSize: 15,
      fontWeight: 800,
      outline: "none",
      boxSizing: "border-box",
      background: isDark ? "#0f172a" : "white",
      color: isDark ? "#f8fafc" : "#0f172a",
    },
    statusSelect: {
      flex: isMobile ? "1 1 calc(50% - 8px)" : "0 1 180px",
      height: 48,
      borderRadius: 12,
      border: isDark ? "1px solid #334155" : "1px solid #d6ead8",
      padding: "0 16px",
      fontSize: 15,
      fontWeight: 800,
      outline: "none",
      boxSizing: "border-box",
      background: isDark ? "#0f172a" : "white",
      color: isDark ? "#f8fafc" : "#0f172a",
    },
    date: {
      flex: isMobile ? "1 1 calc(50% - 8px)" : "0 1 170px",
      height: 48,
      borderRadius: 12,
      border: isDark ? "1px solid #334155" : "1px solid #d6ead8",
      padding: "0 14px",
      fontSize: 15,
      fontWeight: 700,
      outline: "none",
      boxSizing: "border-box",
      background: isDark ? "#0f172a" : "white",
      color: isDark ? "#f8fafc" : "#0f172a",
    },
    clearBtn: {
      height: 48,
      borderRadius: 12,
      border: isDark ? "1px solid #475569" : "1px solid #cbd5e1",
      padding: "0 18px",
      fontSize: 15,
      fontWeight: 800,
      cursor: "pointer",
      background: isDark ? "#1e293b" : "#f8fafc",
      color: isDark ? "#e2e8f0" : "#334155",
    },
    clearSmallBtn: {
      border: "none",
      borderRadius: 10,
      padding: "9px 13px",
      fontSize: 13,
      fontWeight: 900,
      cursor: "pointer",
      background: isDark ? "#334155" : "#e2e8f0",
      color: isDark ? "#e2e8f0" : "#334155",
    },
    mergeBtn: {
      border: "none",
      borderRadius: 10,
      padding: "9px 14px",
      fontSize: 13,
      fontWeight: 900,
      background: "#2563eb",
      color: "white",
    },
    card: {
      marginTop: 28,
      background: isDark ? "#0f172a" : "white",
      borderRadius: 18,
      border: isDark ? "1px solid #1e293b" : "1px solid #d6ead8",
      overflow: "hidden",
      boxShadow: isDark
        ? "0 8px 20px rgba(0, 0, 0, 0.25)"
        : "0 8px 20px rgba(15, 23, 42, 0.04)",
    },
    tableWrap: {
      overflowX: "auto",
    },
    table: {
      width: "100%",
      minWidth: 2050,
      borderCollapse: "collapse",
      fontSize: 15,
    },
    headRow: {
      background: isDark ? "#111827" : "#f3f8f2",
      color: isDark ? "#cbd5e1" : "#475569",
    },
    th: {
      padding: "18px 18px",
      textAlign: "left",
      fontWeight: 800,
      borderBottom: isDark ? "1px solid #1e293b" : "1px solid #d6ead8",
      whiteSpace: "nowrap",
    },
    bodyRow: {
      borderTop: isDark ? "1px solid #1e293b" : "1px solid #d6ead8",
    },
    td: {
      padding: "18px 18px",
      whiteSpace: "nowrap",
      color: isDark ? "#cbd5e1" : "#0f172a",
    },
    tdStrong: {
      padding: "18px 18px",
      fontWeight: 800,
      whiteSpace: "nowrap",
      color: isDark ? "#ffffff" : "#0f172a",
    },
    checkbox: {
      width: 18,
      height: 18,
      cursor: "pointer",
    },
    statusBadge: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 86,
      padding: "7px 10px",
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 900,
      whiteSpace: "nowrap",
    },
    paidBadge: {
      background: isDark ? "#064e3b" : "#dcfce7",
      color: isDark ? "#d1fae5" : "#15803d",
      border: isDark ? "1px solid #047857" : "1px solid #86efac",
    },
    unpaidBadge: {
      background: isDark ? "#7f1d1d" : "#fee2e2",
      color: isDark ? "#fecaca" : "#b91c1c",
      border: isDark ? "1px solid #b91c1c" : "1px solid #fecaca",
    },
    debtBadge: {
      background: isDark ? "#78350f" : "#fef3c7",
      color: isDark ? "#fde68a" : "#92400e",
      border: isDark ? "1px solid #d97706" : "1px solid #fde68a",
    },
    actionGroup: {
      display: "flex",
      justifyContent: "flex-end",
      gap: 8,
    },
    payBtn: {
      background: isDark ? "#15803d" : "#16a34a",
      color: "white",
      border: "none",
      borderRadius: 10,
      padding: "9px 14px",
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    historyBtn: {
      background: isDark ? "#312e81" : "#eef2ff",
      color: isDark ? "#c7d2fe" : "#4338ca",
      border: isDark ? "1px solid #4f46e5" : "1px solid #c7d2fe",
      borderRadius: 10,
      padding: "8px 13px",
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    editBtn: {
      background: isDark ? "#1e293b" : "#f8fafc",
      color: isDark ? "#e2e8f0" : "#334155",
      border: isDark ? "1px solid #475569" : "1px solid #cbd5e1",
      borderRadius: 10,
      padding: "9px 14px",
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    printBtn: {
      background: isDark ? "#064e3b" : "white",
      color: isDark ? "#d1fae5" : "#15803d",
      border: isDark ? "1px solid #047857" : "1px solid #86c78d",
      borderRadius: 10,
      padding: "9px 16px",
      fontWeight: 800,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
    empty: {
      textAlign: "center",
      padding: 30,
      color: isDark ? "#94a3b8" : "#64748b",
    },
    moreWrap: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: "20px",
      borderTop: isDark ? "1px solid #1e293b" : "1px solid #d6ead8",
      background: isDark ? "#0b1220" : "#f8fbf7",
      flexWrap: "wrap",
      marginTop: 18,
      borderRadius: 18,
    },
    countText: {
      margin: 0,
      fontSize: 14,
      fontWeight: 700,
      color: isDark ? "#94a3b8" : "#64748b",
    },
    moreBtn: {
      border: "none",
      borderRadius: 12,
      padding: "11px 20px",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer",
      background: isDark ? "#15803d" : "#16a34a",
      color: "white",
    },
    modalOverlay: {
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      background: "rgba(15, 23, 42, 0.58)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: {
      width: "min(760px, 100%)",
      maxHeight: "90vh",
      overflowY: "auto",
      borderRadius: 20,
      background: isDark ? "#0f172a" : "#ffffff",
      color: isDark ? "#f8fafc" : "#0f172a",
      border: isDark ? "1px solid #334155" : "1px solid #d6ead8",
      boxShadow: "0 30px 90px rgba(0,0,0,0.25)",
      padding: 24,
    },
    modalSmall: {
      width: "min(560px, 100%)",
      maxHeight: "90vh",
      overflowY: "auto",
      borderRadius: 20,
      background: isDark ? "#0f172a" : "#ffffff",
      color: isDark ? "#f8fafc" : "#0f172a",
      border: isDark ? "1px solid #334155" : "1px solid #d6ead8",
      boxShadow: "0 30px 90px rgba(0,0,0,0.25)",
      padding: 24,
    },
    modalHeader: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 14,
      flexWrap: "wrap",
    },
    modalTitle: {
      margin: 0,
      fontSize: 24,
      fontWeight: 900,
    },
    modalSub: {
      margin: "8px 0 0",
      color: isDark ? "#cbd5e1" : "#475569",
      fontWeight: 700,
    },
    paymentPreview: {
      marginTop: 20,
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
      gap: 12,
    },
    previewItem: {
      padding: 14,
      borderRadius: 14,
      background: isDark ? "#020617" : "#f8fafc",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontWeight: 800,
    },
    historyList: {
      marginTop: 20,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    },
    historyRow: {
      display: "grid",
      gridTemplateColumns: "100px 1fr auto",
      gap: 14,
      alignItems: "center",
      padding: 14,
      borderRadius: 14,
      background: isDark ? "#020617" : "#f8fafc",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    },
    historyNumber: {
      fontWeight: 900,
      color: isDark ? "#cbd5e1" : "#334155",
    },
    historyInfo: {
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    historyDate: {
      fontSize: 13,
      fontWeight: 800,
      color: isDark ? "#94a3b8" : "#64748b",
      whiteSpace: "nowrap",
    },
    noHistory: {
      padding: 20,
      borderRadius: 14,
      textAlign: "center",
      fontWeight: 800,
      color: isDark ? "#94a3b8" : "#64748b",
      background: isDark ? "#020617" : "#f8fafc",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    },
    formGrid: {
      marginTop: 22,
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 16,
    },
    label: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      fontSize: 14,
      fontWeight: 900,
      color: isDark ? "#cbd5e1" : "#334155",
    },
    input: {
      height: 46,
      borderRadius: 12,
      border: isDark ? "1px solid #334155" : "1px solid #d6ead8",
      padding: "0 14px",
      fontSize: 15,
      fontWeight: 700,
      outline: "none",
      background: isDark ? "#020617" : "#ffffff",
      color: isDark ? "#f8fafc" : "#0f172a",
      boxSizing: "border-box",
    },
    logicNote: {
      margin: "18px 0 0",
      padding: "12px 14px",
      borderRadius: 14,
      background: isDark ? "#020617" : "#f8fafc",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      color: isDark ? "#cbd5e1" : "#475569",
      fontSize: 14,
      fontWeight: 800,
      lineHeight: "24px",
    },
    modalActions: {
      marginTop: 24,
      display: "flex",
      justifyContent: "flex-end",
      flexWrap: "wrap",
      gap: 10,
    },
    cancelBtn: {
      border: isDark ? "1px solid #475569" : "1px solid #cbd5e1",
      borderRadius: 12,
      padding: "11px 18px",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer",
      background: isDark ? "#1e293b" : "#f8fafc",
      color: isDark ? "#e2e8f0" : "#334155",
    },
    clearModalBtn: {
      border: isDark ? "1px solid #475569" : "1px solid #cbd5e1",
      borderRadius: 12,
      padding: "11px 18px",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer",
      background: isDark ? "#334155" : "#e2e8f0",
      color: isDark ? "#e2e8f0" : "#334155",
      marginRight: "auto",
    },
    saveBtn: {
      border: "none",
      borderRadius: 12,
      padding: "11px 18px",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer",
      background: "#16a34a",
      color: "white",
    },
    printOnlyBtn: {
      border: "none",
      borderRadius: 12,
      padding: "11px 18px",
      fontSize: 15,
      fontWeight: 900,
      cursor: "pointer",
      background: "#2563eb",
      color: "white",
    },
    mergeDesc: {
      marginTop: 10,
      color: isDark ? "#cbd5e1" : "#475569",
      fontWeight: 700,
    },
    mergeSummary: {
      marginTop: 18,
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: 12,
    },
    mergeItem: {
      padding: 14,
      borderRadius: 14,
      background: isDark ? "#020617" : "#f8fafc",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      gap: 6,
      fontWeight: 800,
    },
    selectedInvoices: {
      marginTop: 18,
      borderRadius: 14,
      overflow: "hidden",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    },
    selectedInvoiceRow: {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      padding: "12px 14px",
      borderTop: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      fontWeight: 800,
    },
    scrollControls: {
      position: "sticky",
      top: 10,
      zIndex: 20,
      display: "flex",
      justifyContent: "center",
      gap: 8,
      padding: "6px 0",
      pointerEvents: "none",
      margin: "10px auto 0",
    },
    scrollBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      border: isDark ? "1px solid #334155" : "1px solid #cbd5e1",
      cursor: "pointer",
      fontSize: 15,
      fontWeight: 900,
      background: isDark
        ? "rgba(15, 23, 42, 0.88)"
        : "rgba(255, 255, 255, 0.9)",
      color: isDark ? "#cbd5e1" : "#334155",
      boxShadow: isDark
        ? "0 8px 18px rgba(0, 0, 0, 0.22)"
        : "0 8px 18px rgba(15, 23, 42, 0.08)",
      pointerEvents: "auto",
    },
    mobileInvoiceCard: {
      background: isDark ? "#0f172a" : "white",
      border: isDark ? "1px solid #1e293b" : "1px solid #d6ead8",
      borderRadius: 18,
      padding: 16,
      marginBottom: 14,
      boxShadow: isDark
        ? "0 10px 24px rgba(0,0,0,0.25)"
        : "0 10px 24px rgba(15,23,42,0.06)",
    },
    mobileInvoiceTop: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
    },
    mobileInvoiceHeaderText: {
      minWidth: 0,
      flex: 1,
    },
    mobileInvoiceNo: {
      margin: 0,
      fontSize: 16,
      fontWeight: 950,
      color: isDark ? "#ffffff" : "#0f172a",
      wordBreak: "break-word",
      lineHeight: "22px",
    },
    mobileDate: {
      margin: "5px 0 0",
      fontSize: 12,
      fontWeight: 800,
      color: isDark ? "#94a3b8" : "#64748b",
    },
    mobileCustomerBox: {
      marginTop: 14,
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
    },
    mobileInfoItem: {
      minWidth: 0,
    },
    mobileProductBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      background: isDark ? "#020617" : "#f8fafc",
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    mobileLabel: {
      display: "block",
      fontSize: 11,
      fontWeight: 900,
      color: isDark ? "#94a3b8" : "#64748b",
    },
    mobileValue: {
      display: "block",
      marginTop: 4,
      fontSize: 14,
      fontWeight: 950,
      color: isDark ? "#f8fafc" : "#0f172a",
      wordBreak: "break-word",
    },
    mobileSubText: {
      fontSize: 12,
      fontWeight: 800,
      color: isDark ? "#94a3b8" : "#64748b",
    },
    mobileMoneyGrid: {
      marginTop: 12,
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      overflow: "hidden",
      borderRadius: 14,
      border: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
    },
    mobileMoneyItem: {
      padding: "11px 8px",
      background: isDark ? "#020617" : "#f8fafc",
      borderRight: isDark ? "1px solid #334155" : "1px solid #e2e8f0",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      fontSize: 11,
      fontWeight: 800,
      color: isDark ? "#94a3b8" : "#64748b",
      minWidth: 0,
    },
    mobileDebtMoney: {
      color: isDark ? "#fecaca" : "#b91c1c",
      background: isDark ? "#450a0a" : "#fef2f2",
    },
    mobileUtilityRow: {
      marginTop: 12,
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
    },
    mobileSelectCheck: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 13,
      fontWeight: 900,
      color: isDark ? "#cbd5e1" : "#334155",
    },
    mobileActions: {
      marginTop: 12,
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 8,
    },
    mobileEmpty: {
      padding: 24,
      textAlign: "center",
      borderRadius: 16,
      border: isDark ? "1px dashed #334155" : "1px dashed #cbd5e1",
      color: isDark ? "#94a3b8" : "#64748b",
      fontWeight: 900,
      marginTop: 20,
    },
    deleteBtn: {
      background: "#dc2626",
      color: "white",
      border: "none",
      borderRadius: 10,
      padding: "9px 14px",
      fontWeight: 900,
      cursor: "pointer",
      whiteSpace: "nowrap",
    },
  };
}

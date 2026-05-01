import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import PrintInvoice from "../components/PrintInvoice";
import html2canvas from "html2canvas";

const TYPE_LABELS = {
  A: "ការ៉ុត",
  B: "បាកាន",
  C: "សំបកក្រហមស",
};

const TYPES = ["A", "B", "C"];
const GRADES = [1, 2, 3];
const PRICE_OPTIONS = [800, 1000, 1200];
const QUANTITY_OPTIONS = [5, 10, 15];
const WALK_IN_CUSTOMER = "លក់ក្រៅ";

function formatKg(kg) {
  const value = Number(kg || 0);
  if (value >= 1000) return `${(value / 1000).toLocaleString()} តោន`;
  return `${value.toLocaleString()} គីឡូ`;
}

function formatRiel(value) {
  return `${Number(value || 0).toLocaleString()} រៀល`;
}

function today() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function paymentLabel(method) {
  return method === "qr" ? "QR" : "សាច់ប្រាក់";
}

function paymentStatusLabel(status) {
  if (status === "paid") return "បានទូទាត់";
  if (status === "debt") return "ជំពាក់";
  return "មិនទាន់ទូទាត់";
}

function productKhmer(product) {
  if (!product) return "—";
  return `${TYPE_LABELS[product.type] || product.type} លេខ ${product.grade}`;
}

function parseMoneyInput(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function parseDecimalInput(value) {
  return String(value || "")
    .replace(/[^0-9.]/g, "")
    .replace(/(\..*)\./g, "$1");
}

function formatMoneyInput(value) {
  const raw = parseMoneyInput(value);
  if (!raw) return "";
  return Number(raw).toLocaleString();
}

function preventNumberControl(e) {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") {
    e.preventDefault();
  }
}

export default function Sell() {
  const suggestionRef = useRef(null);
  const invoiceImageRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [activeType, setActiveType] = useState("A");
  const [activeGrade, setActiveGrade] = useState(1);

  const [customerName, setCustomerName] = useState(WALK_IN_CUSTOMER);
  const [customerPhone, setCustomerPhone] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("kg");
  const [pricePerKg, setPricePerKg] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("unpaid");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [saleDate, setSaleDate] = useState(today());
  const [hasDelivery, setHasDelivery] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState("");

  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [savingImage, setSavingImage] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchProducts() {
    const res = await api.get("/products");
    setProducts(res.data);
  }

  const selectedProduct = useMemo(() => {
    return products.find(
      (item) =>
        String(item.type) === activeType && Number(item.grade) === activeGrade
    );
  }, [products, activeType, activeGrade]);

  async function fetchCustomers(value) {
    if (!value.trim() || value.trim() === WALK_IN_CUSTOMER) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await api.get(`/customers?search=${encodeURIComponent(value)}`);
      setSuggestions(res.data);
    } catch {
      setSuggestions([]);
    }
  }

  const quantityKg = useMemo(() => {
    const value = Number(quantity || 0);
    return unit === "ton" ? value * 1000 : value;
  }, [quantity, unit]);

  const stockKg = Number(selectedProduct?.stock_kg || 0);
  const price = Number(pricePerKg || 0);
  const deliveryAmount = hasDelivery ? Number(deliveryFee || 0) : 0;
  const currentSubtotal = quantityKg * price;
  const stockAfterSale = Math.max(stockKg - quantityKg, 0);
  const isOverStock = quantityKg > stockKg;

  const cartTotal = cartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalPreview = cartTotal + currentSubtotal + deliveryAmount;
  const paidPreview =
    paymentStatus === "paid"
      ? totalPreview
      : paymentStatus === "unpaid"
        ? 0
        : Number(paidAmount || 0);
  const balancePreview = Math.max(totalPreview - paidPreview, 0);

  function goToStockPage() {
    const params = new URLSearchParams();

    if (selectedProduct?.type) params.set("type", selectedProduct.type);
    if (selectedProduct?.grade) params.set("grade", selectedProduct.grade);
    if (quantity) params.set("quantity", quantity);
    if (unit) params.set("unit", unit);

    window.location.href = `/stock?${params.toString()}`;
  }

  function buildCurrentItem() {
    if (!selectedProduct?.id) {
      alert("រកមិនឃើញប្រភេទទំនិញនេះទេ។");
      return null;
    }

    if (!quantity || Number(quantity) <= 0) {
      alert("សូមបញ្ចូលបរិមាណ។");
      return null;
    }

    if (!pricePerKg || Number(pricePerKg) <= 0) {
      alert("សូមបញ្ចូលតម្លៃក្នុង ១ គីឡូ។");
      return null;
    }

    if (isOverStock) {
      setStockModalOpen(true);
      return null;
    }

    return {
      product_id: selectedProduct.id,
      product: selectedProduct,
      quantity: Number(quantity),
      unit,
      quantity_kg: quantityKg,
      price_per_kg: price,
      subtotal: currentSubtotal,
    };
  }

  function clearItemFields() {
    setQuantity("");
    setUnit("kg");
    setPricePerKg("");
  }

  function addItemToCart() {
    const item = buildCurrentItem();
    if (!item) return;

    setCartItems((prev) => [...prev, item]);
    clearItemFields();
  }

  function removeItem(index) {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  }

  function selectPaymentStatus(status) {
    setPaymentStatus(status);

    if (status === "paid") {
      setPaidAmount(String(totalPreview));
      return;
    }

    if (status === "unpaid") {
      setPaidAmount("");
    }
  }

  async function handleSaveImage() {
    if (!invoice || !invoiceImageRef.current || savingImage) return;

    setSavingImage(true);

    try {
      const target =
        invoiceImageRef.current.querySelector(".heng-huy-print") ||
        invoiceImageRef.current;

      await document.fonts.ready;

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
        link.download = `${invoice.invoice_no || "invoice"}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, "image/png");
    } catch (error) {
      console.error("Save invoice image error:", error);
      alert("រក្សាទុករូបភាពមិនបានទេ។");
    } finally {
      setSavingImage(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const finalCustomerName = customerName.trim() || WALK_IN_CUSTOMER;
    const finalCustomerPhone =
      finalCustomerName === WALK_IN_CUSTOMER ? "" : customerPhone.trim();

    if (finalCustomerName !== WALK_IN_CUSTOMER && !finalCustomerPhone) {
      alert("សូមបញ្ចូលលេខទូរស័ព្ទសម្រាប់អតិថិជននេះ។");
      return;
    }

    if (!saleDate) {
      alert("សូមជ្រើសកាលបរិច្ឆេទលក់។");
      return;
    }

    let finalItems = [...cartItems];

    if (quantity || pricePerKg) {
      const currentItem = buildCurrentItem();
      if (!currentItem) return;
      finalItems.push(currentItem);
    }

    if (finalItems.length === 0) {
      alert("សូមបញ្ចូលទំនិញមុនបង្កើតវិក្កយបត្រ។");
      return;
    }

    const finalItemsTotal = finalItems.reduce(
      (sum, item) => sum + Number(item.subtotal || 0),
      0
    );
    const finalDeliveryFee = hasDelivery ? Number(deliveryFee || 0) : 0;
    const finalTotal = finalItemsTotal + finalDeliveryFee;
    const finalPaidAmount =
      paymentStatus === "paid"
        ? finalTotal
        : paymentStatus === "unpaid"
          ? 0
          : Number(paidAmount || 0);

    if (paymentStatus === "debt" && finalPaidAmount <= 0) {
      alert("សូមបញ្ចូលចំនួនប្រាក់កក់។");
      return;
    }

    if (paymentStatus === "debt" && finalPaidAmount >= finalTotal) {
      alert("បើបង់គ្រប់ សូមជ្រើស បានទូទាត់។");
      return;
    }

    setLoading(true);
    setInvoice(null);

    try {
      const res = await api.post("/sales", {
        sale_date: saleDate || today(),
        customer_name: finalCustomerName,
        customer_phone: finalCustomerPhone,
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        paid_amount: finalPaidAmount,
        delivery_fee: finalDeliveryFee,
        items: finalItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          unit: item.unit,
          price_per_kg: item.price_per_kg,
        })),
      });

      setInvoice({
        ...res.data,
        payment_status: res.data.payment_status || paymentStatus,
        paid_amount: res.data.paid_amount ?? finalPaidAmount,
        delivery_fee: res.data.delivery_fee ?? finalDeliveryFee,
      });

      const productsRes = await api.get("/products");
      setProducts(productsRes.data);

      setCustomerName(WALK_IN_CUSTOMER);
      setCustomerPhone("");
      clearItemFields();
      setPaymentStatus("unpaid");
      setPaymentMethod("cash");
      setPaidAmount("");
      setSaleDate(today());
      setHasDelivery(false);
      setDeliveryFee("");
      setCartItems([]);
      setSuggestions([]);
      setShowSuggestions(false);
    } catch (error) {
      const message = error.response?.data?.message || "";

      if (
        message.includes("stock") ||
        message.includes("ស្តុក") ||
        message.includes("គ្រប់គ្រាន់")
      ) {
        setStockModalOpen(true);
      } else {
        alert(message || "បង្កើតវិក្កយបត្រមិនបានទេ។");
      }
    } finally {
      setLoading(false);
    }
  }

  const optionButtonBase =
    "rounded-xl border px-5 py-3 font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]";

  const fullOptionButtonBase =
    "rounded-xl border px-4 py-3 font-bold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]";

  return (
    <>
      <style>{`
        .sell-no-spinner::-webkit-inner-spin-button,
        .sell-no-spinner::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }

        .sell-no-spinner {
          -moz-appearance: textfield;
        }

        .invoice-image-capture {
          position: fixed;
          left: -10000px;
          top: 0;
          width: 794px;
          background: #ffffff;
          color: #173f8f;
          z-index: -1;
        }

        @media print {
          .invoice-image-capture {
            display: none !important;
          }
        }
      `}</style>

      <main className="min-h-screen bg-[#f7faf5] dark:bg-slate-950 px-4 py-8 text-slate-900 dark:text-white print:hidden md:px-8">
        <section className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-black">ការលក់ថ្មី</h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400">
              លក់ដំឡូង កាត់ស្តុក និងបង្កើតវិក្កយបត្រ។
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-green-100 dark:border-green-800/60 bg-white dark:bg-slate-900 p-5 shadow-sm md:p-6"
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div ref={suggestionRef} className="relative">
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    ឈ្មោះអតិថិជន
                  </label>

                  <input
                    value={customerName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCustomerName(value);

                      if (value === WALK_IN_CUSTOMER) {
                        setCustomerPhone("");
                      }

                      fetchCustomers(value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="ជ្រើស លក់ក្រៅ ឬបញ្ចូលឈ្មោះអតិថិជន"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 px-4 py-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />

                  {showSuggestions && (
                    <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerName(WALK_IN_CUSTOMER);
                          setCustomerPhone("");
                          setSuggestions([]);
                          setShowSuggestions(false);
                        }}
                        className="block w-full px-4 py-3 text-left text-sm transition-colors hover:bg-green-50 dark:hover:bg-green-950/30"
                      >
                        <div className="font-bold dark:text-white">
                          {WALK_IN_CUSTOMER}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          អតិថិជនទូទៅ មិនចាំបាច់លេខទូរស័ព្ទ
                        </div>
                      </button>

                      {suggestions.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            setCustomerName(item.name);
                            setCustomerPhone(item.phone || "");
                            setShowSuggestions(false);
                          }}
                          className="block w-full px-4 py-3 text-left text-sm transition-colors hover:bg-green-50 dark:hover:bg-green-950/30"
                        >
                          <div className="font-bold dark:text-white">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {item.phone || "គ្មានលេខទូរស័ព្ទ"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    លេខទូរស័ព្ទ
                  </label>

                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    disabled={customerName.trim() === WALK_IN_CUSTOMER}
                    placeholder={
                      customerName.trim() === WALK_IN_CUSTOMER
                        ? "មិនចាំបាច់បញ្ចូល"
                        : "បញ្ចូលលេខទូរស័ព្ទ"
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 px-4 py-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    កាលបរិច្ឆេទលក់
                  </label>
                  <input
                    type="date"
                    value={saleDate}
                    onChange={(e) => setSaleDate(e.target.value || today())}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white px-4 py-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    ប្រភេទដំឡូង
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          setActiveType(type);
                          setActiveGrade(1);
                        }}
                        className={`${optionButtonBase} ${
                          activeType === type
                            ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-green-300 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-green-700 dark:hover:bg-green-950/30"
                        }`}
                      >
                        {TYPE_LABELS[type]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    លេខ
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {GRADES.map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => setActiveGrade(grade)}
                        className={`${optionButtonBase} ${
                          activeGrade === grade
                            ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                            : "border-slate-200 bg-white text-slate-700 hover:border-green-300 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-green-700 dark:hover:bg-green-950/30"
                        }`}
                      >
                        លេខ {grade}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    បរិមាណ
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={quantity}
                      onChange={(e) => setQuantity(parseDecimalInput(e.target.value))}
                      onKeyDown={preventNumberControl}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="0"
                      className="sell-no-spinner w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 px-4 py-3 pr-24 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    />

                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setQuantity(e.target.value);
                      }}
                      className="absolute right-2 top-1/2 h-9 -translate-y-1/2 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 pr-7 text-xs font-bold text-slate-700 outline-none transition hover:border-green-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-green-700"
                    >
                      <option value="">ជ្រើស</option>
                      {QUANTITY_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 dark:text-slate-400">
                      ▼
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    តម្លៃក្នុង ១ គីឡូ
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pricePerKg}
                      onChange={(e) => setPricePerKg(parseMoneyInput(e.target.value))}
                      onKeyDown={preventNumberControl}
                      onWheel={(e) => e.currentTarget.blur()}
                      placeholder="0"
                      className="sell-no-spinner w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 px-4 py-3 pr-24 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    />

                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setPricePerKg(e.target.value);
                      }}
                      className="absolute right-2 top-1/2 h-9 -translate-y-1/2 cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 px-3 pr-7 text-xs font-bold text-slate-700 outline-none transition hover:border-green-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-green-700"
                    >
                      <option value="">ជ្រើស</option>
                      {PRICE_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>

                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 dark:text-slate-400">
                      ▼
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    ឯកតា
                  </label>
                  <div className="relative">
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full cursor-pointer appearance-none rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 px-4 py-3 pr-11 outline-none transition hover:border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-100 dark:hover:border-green-700"
                    >
                      <option value="kg">គីឡូ</option>
                      <option value="ton">តោន</option>
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-500 dark:text-slate-400">
                      ▼
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    ស្តុកមាន
                  </label>
                  <div className="rounded-xl border border-green-100 dark:border-green-800/60 bg-green-50 dark:bg-green-950/30 px-4 py-3 font-bold text-green-700 dark:text-green-400">
                    {formatKg(stockKg)}
                  </div>
                </div>

                <div className="md:col-span-2">
                  <button
                    type="button"
                    onClick={addItemToCart}
                    className="w-full rounded-xl bg-slate-900 dark:bg-slate-700 px-5 py-4 font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md active:scale-[0.99] dark:hover:bg-slate-600"
                  >
                    បន្ថែមទំនិញមួយទៀត
                  </button>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    បើមានតែទំនិញមួយ មិនចាំបាច់ចុចប៊ូតុងនេះទេ។ អាចបង្កើតវិក្កយបត្របានភ្លាមៗ។
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    ថ្លៃដឹកជញ្ជូន
                  </label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => {
                        setHasDelivery(false);
                        setDeliveryFee("");
                      }}
                      className={`${fullOptionButtonBase} ${
                        !hasDelivery
                          ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-green-300 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-green-700 dark:hover:bg-green-950/30"
                      }`}
                    >
                      មិនមានថ្លៃដឹក
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasDelivery(true)}
                      className={`${fullOptionButtonBase} ${
                        hasDelivery
                          ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-green-300 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-green-700 dark:hover:bg-green-950/30"
                      }`}
                    >
                      មានថ្លៃដឹក
                    </button>
                  </div>

                  {hasDelivery && (
                    <input
                      inputMode="numeric"
                      value={formatMoneyInput(deliveryFee)}
                      onChange={(e) => setDeliveryFee(parseMoneyInput(e.target.value))}
                      placeholder="បញ្ចូលថ្លៃដឹក"
                      className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 px-4 py-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    />
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    ស្ថានភាពទូទាត់
                  </label>
                  <div className="grid gap-3 md:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => selectPaymentStatus("paid")}
                      className={`${fullOptionButtonBase} ${
                        paymentStatus === "paid"
                          ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-green-300 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-green-700 dark:hover:bg-green-950/30"
                      }`}
                    >
                      បានទូទាត់
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPaymentStatus("debt")}
                      className={`${fullOptionButtonBase} ${
                        paymentStatus === "debt"
                          ? "border-yellow-600 bg-yellow-500 text-white hover:bg-yellow-600"
                          : "border-slate-200 bg-white text-slate-700 hover:border-yellow-300 hover:bg-yellow-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-yellow-700 dark:hover:bg-yellow-950/30"
                      }`}
                    >
                      កក់ប្រាក់
                    </button>
                    <button
                      type="button"
                      onClick={() => selectPaymentStatus("unpaid")}
                      className={`${fullOptionButtonBase} ${
                        paymentStatus === "unpaid"
                          ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-red-700 dark:hover:bg-red-950/30"
                      }`}
                    >
                      មិនទាន់ទូទាត់
                    </button>
                  </div>
                </div>

                {paymentStatus === "debt" && (
                  <div className="md:col-span-2">
                    <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                      ចំនួនប្រាក់កក់
                    </label>
                    <input
                      inputMode="numeric"
                      value={formatMoneyInput(paidAmount)}
                      onChange={(e) => setPaidAmount(parseMoneyInput(e.target.value))}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 px-4 py-3 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                    />
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="mb-2 block text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                    វិធីបង់ប្រាក់
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`${fullOptionButtonBase} ${
                        paymentMethod === "cash"
                          ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-green-300 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-green-700 dark:hover:bg-green-950/30"
                      }`}
                    >
                      សាច់ប្រាក់
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("qr")}
                      className={`${fullOptionButtonBase} ${
                        paymentMethod === "qr"
                          ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-green-300 hover:bg-green-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-green-700 dark:hover:bg-green-950/30"
                      }`}
                    >
                      QR
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-col items-center justify-center gap-4">
                <button
                  disabled={loading}
                  className="w-full max-w-md rounded-xl bg-green-600 px-10 py-4 font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:scale-[0.99] disabled:bg-slate-300 dark:disabled:bg-slate-700"
                >
                  {loading ? "កំពុងបង្កើត..." : "បង្កើតវិក្កយបត្រ"}
                </button>

                <p
                  className={
                    isOverStock
                      ? "text-center font-semibold text-red-600"
                      : "text-center text-slate-600 dark:text-slate-300"
                  }
                >
                  ស្តុកនៅសល់ក្រោយលក់:{" "}
                  <span className="font-bold">{formatKg(stockAfterSale)}</span>
                </p>
              </div>
            </form>

            <aside className="rounded-2xl border border-green-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm md:p-6">
              <h2 className="mb-5 text-lg font-bold dark:text-white">
                សង្ខេបវិក្កយបត្រ
              </h2>

              <div className="space-y-4 text-sm">
                <Row label="អតិថិជន" value={customerName || WALK_IN_CUSTOMER} />
                <Row label="ទូរស័ព្ទ" value={customerPhone || "—"} />
                <Row label="កាលបរិច្ឆេទលក់" value={saleDate || today()} />
                <Row label="ស្ថានភាពទូទាត់" value={paymentStatusLabel(paymentStatus)} />
                <Row label="វិធីបង់ប្រាក់" value={paymentLabel(paymentMethod)} />

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <p className="mb-3 font-bold dark:text-white">
                    ទំនិញក្នុងវិក្កយបត្រ
                  </p>

                  {cartItems.map((item, index) => (
                    <div
                      key={`${item.product_id}-${index}`}
                      className="mb-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="font-bold dark:text-white">
                            {productKhmer(item.product)}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatKg(item.quantity_kg)} ×{" "}
                            {formatRiel(item.price_per_kg)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="rounded-lg px-2 text-base font-black text-red-600 transition hover:bg-red-50 hover:text-red-700 active:scale-95 dark:hover:bg-red-950/30"
                        >
                          លុប
                        </button>
                      </div>
                      <div className="mt-2 text-right font-bold dark:text-white">
                        {formatRiel(item.subtotal)}
                      </div>
                    </div>
                  ))}

                  {(quantity || pricePerKg) && (
                    <div className="mb-3 rounded-xl border border-green-100 dark:border-green-800/60 bg-green-50 dark:bg-green-950/30 p-3">
                      <p className="font-bold dark:text-white">
                        {productKhmer(selectedProduct)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatKg(quantityKg)} × {formatRiel(price)}
                      </p>
                      <div className="mt-2 text-right font-bold dark:text-white">
                        {formatRiel(currentSubtotal)}
                      </div>
                    </div>
                  )}

                  {hasDelivery && deliveryAmount > 0 && (
                    <div className="mb-3 rounded-xl border border-blue-100 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 p-3">
                      <p className="font-bold dark:text-white">ថ្លៃដឹកជញ្ជូន</p>
                      <div className="mt-2 text-right font-bold dark:text-white">
                        {formatRiel(deliveryAmount)}
                      </div>
                    </div>
                  )}

                  {cartItems.length === 0 &&
                    !quantity &&
                    !pricePerKg &&
                    deliveryAmount <= 0 && (
                      <p className="text-slate-400 dark:text-slate-500">
                        មិនទាន់មានទំនិញ
                      </p>
                    )}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-5 space-y-3">
                  <Row label="សរុប" value={formatRiel(totalPreview)} strong />
                  <Row label="បានបង់" value={formatRiel(paidPreview)} />
                  <Row
                    label="នៅសល់"
                    value={formatRiel(balancePreview)}
                    danger={balancePreview > 0}
                  />
                </div>
              </div>

              {invoice && (
                <div className="mt-6 space-y-3 rounded-xl bg-green-50 dark:bg-green-950/30 p-4 text-sm text-green-800 dark:text-green-300">
                  <div>
                    បានបង្កើតវិក្កយបត្រ: <b>{invoice.invoice_no}</b>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-md active:scale-[0.99]"
                    >
                      បោះពុម្ព
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveImage}
                      disabled={savingImage}
                      className="rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md active:scale-[0.99] disabled:bg-slate-300 dark:disabled:bg-slate-700"
                    >
                      {savingImage ? "កំពុងរក្សាទុក..." : "រក្សាទុករូបភាព"}
                    </button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>
      </main>

      {stockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 print:hidden">
          <div className="w-full max-w-md rounded-2xl border border-red-100 bg-white p-6 shadow-2xl dark:border-red-900/60 dark:bg-slate-900">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl dark:bg-red-950/50">
              ⚠️
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              ស្តុកមិនគ្រប់គ្រាន់
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
              ទំនិញនេះមិនមានស្តុកគ្រប់គ្រាន់សម្រាប់ការលក់ទេ។ សូមបន្ថែមស្តុកថ្មី
              ឬបោះបង់ការលក់នេះ។
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">ទំនិញ</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {productKhmer(selectedProduct)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">ស្តុកមាន</span>
                <span className="font-bold text-green-600 dark:text-green-400">
                  {formatKg(stockKg)}
                </span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">ចង់លក់</span>
                <span className="font-bold text-red-600 dark:text-red-400">
                  {formatKg(quantityKg)}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setStockModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-bold text-slate-700 transition-all duration-200 hover:bg-slate-50 active:scale-[0.98] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                បោះបង់
              </button>

              <button
                type="button"
                onClick={goToStockPage}
                className="rounded-xl bg-green-600 px-4 py-3 font-bold text-white transition-all duration-200 hover:bg-green-700 active:scale-[0.98]"
              >
                បន្ថែមស្តុកថ្មី
              </button>
            </div>
          </div>
        </div>
      )}

      {invoice && (
        <PrintInvoice
          ref={invoiceImageRef}
          invoice={invoice}
          captureMode={true}
        />
      )}

      {invoice && <PrintInvoice invoice={invoice} />}
    </>
  );
}

function Row({ label, value, strong, danger }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span
        className={`text-right font-bold ${
          danger
            ? "text-red-600 dark:text-red-400"
            : strong
              ? "text-green-600 dark:text-green-400"
              : "dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
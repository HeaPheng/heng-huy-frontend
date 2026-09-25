import { useCallback, useEffect, useRef, useState } from "react";
import api from "../api";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;
const EMPTY_PAGE = { next_cursor: null, has_more: false, total: 0, queryKey: null };

function uniqueSales(existing, incoming) {
  const seen = new Set(existing.map((sale) => sale.id));
  return [...existing, ...incoming.filter((sale) => {
    if (seen.has(sale.id)) return false;
    seen.add(sale.id);
    return true;
  })];
}

export default function useSalesHistory(filters) {
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  const [sales, setSales] = useState([]);
  const [pageInfo, setPageInfo] = useState(EMPTY_PAGE);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [salesError, setSalesError] = useState(false);
  const generationRef = useRef(0);
  const controllersRef = useRef(new Set());
  const pageInfoRef = useRef(EMPTY_PAGE);
  const prefetchedRef = useRef(null);
  const prefetchRequestRef = useRef(null);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  const searchPending = filters.search !== debouncedSearch;
  const queryKey = JSON.stringify({
    search: debouncedSearch,
    product_id: filters.selectedProductId === "all" ? null : filters.selectedProductId,
    payment_status: filters.paymentStatus === "all" ? null : filters.paymentStatus,
    invoice_type: filters.invoiceType,
    date_from: filters.dateFrom || null,
    date_to: filters.dateTo || null,
    date_from_offset: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`).getTimezoneOffset() : null,
    date_to_offset: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59`).getTimezoneOffset() : null,
  });

  const cancelRequests = useCallback(() => {
    for (const controller of controllersRef.current) controller.abort();
    controllersRef.current.clear();
    prefetchedRef.current = null;
    prefetchRequestRef.current = null;
  }, []);

  const requestPage = useCallback(async (query, cursor) => {
    const controller = new AbortController();
    controllersRef.current.add(controller);
    try {
      const response = await api.get("/sales", {
        params: { ...query, cursor: cursor || undefined, per_page: PAGE_SIZE },
        signal: controller.signal,
      });
      return response.data;
    } finally {
      controllersRef.current.delete(controller);
    }
  }, []);

  const refreshSales = useCallback(async () => {
    const generation = ++generationRef.current;
    cancelRequests();
    loadingMoreRef.current = false;
    pageInfoRef.current = EMPTY_PAGE;
    setPageInfo(EMPTY_PAGE);
    setSales([]);
    setSalesError(false);
    setLoadingMore(false);
    setLoadingSales(true);

    try {
      const page = await requestPage(JSON.parse(queryKey), null);
      if (generation !== generationRef.current) return null;

      const next = {
        next_cursor: page.next_cursor,
        has_more: Boolean(page.has_more),
        total: Number(page.total || 0),
        queryKey,
      };
      pageInfoRef.current = next;
      setSales(uniqueSales([], page.data || []));
      setPageInfo(next);
      return page;
    } catch {
      if (generation === generationRef.current) setSalesError(true);
      return null;
    } finally {
      if (generation === generationRef.current) setLoadingSales(false);
    }
  }, [cancelRequests, queryKey, requestPage]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) refreshSales();
    });
    const generation = generationRef;
    return () => {
      active = false;
      generation.current++;
      cancelRequests();
    };
  }, [refreshSales, cancelRequests]);

  useEffect(() => {
    if (!searchPending) return;
    generationRef.current++;
    cancelRequests();
  }, [searchPending, filters.search, cancelRequests]);

  const prefetch = useCallback((cursor, generation, key) => {
    if (!cursor || prefetchedRef.current?.cursor === cursor || prefetchRequestRef.current?.cursor === cursor) return;

    const promise = requestPage(JSON.parse(key), cursor)
      .then((page) => {
        if (generation === generationRef.current && pageInfoRef.current.queryKey === key && pageInfoRef.current.next_cursor === cursor) {
          prefetchedRef.current = { cursor, page };
        }
        return page;
      })
      .catch(() => null)
      .finally(() => {
        if (prefetchRequestRef.current?.promise === promise) prefetchRequestRef.current = null;
      });

    prefetchRequestRef.current = { cursor, promise };
  }, [requestPage]);

  useEffect(() => {
    if (searchPending || loadingSales || pageInfo.queryKey !== queryKey || !pageInfo.has_more) return;
    prefetch(pageInfo.next_cursor, generationRef.current, queryKey);
  }, [pageInfo, queryKey, searchPending, loadingSales, prefetch]);

  const seeMore = useCallback(async () => {
    const current = pageInfoRef.current;
    if (loadingMoreRef.current || searchPending || current.queryKey !== queryKey || !current.has_more || !current.next_cursor) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    const generation = generationRef.current;
    const cursor = current.next_cursor;

    try {
      let page = prefetchedRef.current?.cursor === cursor ? prefetchedRef.current.page : null;
      if (!page && prefetchRequestRef.current?.cursor === cursor) {
        page = await prefetchRequestRef.current.promise;
      }
      if (!page) page = await requestPage(JSON.parse(queryKey), cursor);
      if (generation !== generationRef.current || pageInfoRef.current.next_cursor !== cursor) return;

      prefetchedRef.current = null;
      const next = {
        next_cursor: page.next_cursor,
        has_more: Boolean(page.has_more),
        total: Number(page.total || 0),
        queryKey,
      };
      pageInfoRef.current = next;
      setSales((previous) => uniqueSales(previous, page.data || []));
      setPageInfo(next);
    } catch {
      // Leave the current rows and cursor intact so See More can retry.
    } finally {
      loadingMoreRef.current = false;
      if (generation === generationRef.current) setLoadingMore(false);
    }
  }, [queryKey, requestPage, searchPending]);

  return {
    sales,
    setSales,
    refreshSales,
    seeMore,
    hasMore: pageInfo.has_more,
    total: pageInfo.total,
    loadingSales,
    loadingMore,
    salesError,
    searchPending,
  };
}

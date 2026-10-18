import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState, type ReactNode } from "react";
import { ClipboardList, PackagePlus, Plus, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AppSidebar } from "@/components/dashboard/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCrmSource, createLead, listAllPipelineStages, listCrmSources } from "@/lib/crm.functions";
import { listLeads } from "@/lib/leads.functions";
import { listProductCatalogs, saveProduct, type DbProduct } from "@/lib/products.functions";

export const Route = createFileRoute("/pedidos")({
  head: () => ({ meta: [{ title: "Pedidos · Saúde Slim" }, { name: "description", content: "Retirada de pedidos da operação Saúde Slim." }] }),
  component: PedidosPage,
});

type ProductMode = "existing" | "new" | "free";
type CustomerMode = "existing" | "new" | "none";
type DiscountMode = "value" | "percent";

function PedidosPage() {
  const loadLeads = useServerFn(listLeads);
  const loadCatalogs = useServerFn(listProductCatalogs);
  const loadSources = useServerFn(listCrmSources);
  const loadPipelines = useServerFn(listAllPipelineStages);
  const createLeadFn = useServerFn(createLead);
  const createSourceFn = useServerFn(createCrmSource);
  const saveProductFn = useServerFn(saveProduct);

  const leadsQ = useQuery({ queryKey: ["pedidos", "leads"], queryFn: () => loadLeads({ data: {} }), staleTime: 30_000 });
  const catalogsQ = useQuery({ queryKey: ["pedidos", "catalogs"], queryFn: () => loadCatalogs(), staleTime: 30_000 });
  const sourcesQ = useQuery({ queryKey: ["pedidos", "sources"], queryFn: () => loadSources(), staleTime: 60_000 });
  const pipelinesQ = useQuery({ queryKey: ["pedidos", "pipelines"], queryFn: () => loadPipelines(), staleTime: 60_000 });

  const products = useMemo(() => (catalogsQ.data ?? []).flatMap((catalog) => catalog.products.map((product) => ({ ...product, catalogName: catalog.name }))), [catalogsQ.data]);
  const leads = leadsQ.data?.leads ?? [];
  const sources = sourcesQ.data?.sources ?? [];
  const pipelines = pipelinesQ.data?.pipelines ?? [];
  const defaultSourceId = (sources.find((source) => source.is_default) ?? sources[0])?.id ?? "";
  const defaultPipeline = pipelines[0];
  const defaultStageId = defaultPipeline?.stages[0]?.id ?? "";

  const [productMode, setProductMode] = useState<ProductMode>("existing");
  const [productId, setProductId] = useState("");
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [customerMode, setCustomerMode] = useState<CustomerMode>("existing");
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [discountMode, setDiscountMode] = useState<DiscountMode>("value");
  const [discount, setDiscount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = products.find((product) => product.id === productId) as (DbProduct & { catalogName?: string }) | undefined;
  const basePrice = productMode === "existing" ? Number(selectedProduct?.promoPrice ?? selectedProduct?.price ?? 0) : moneyToNumber(productPrice);
  const discountValue = discountMode === "percent" ? basePrice * Math.min(100, Math.max(0, moneyToNumber(discount))) / 100 : Math.max(0, moneyToNumber(discount));
  const total = Math.max(0, basePrice - discountValue);
  const filteredLeads = leads.filter((lead) => {
    const needle = customerSearch.trim().toLowerCase();
    if (!needle) return true;
    return [lead.name, lead.email, lead.phone].some((value) => (value ?? "").toLowerCase().includes(needle));
  }).slice(0, 8);

  async function submitOrder() {
    setError(null);
    if (!defaultPipeline?.id || !defaultStageId) return setError("Crie um funil e uma etapa antes de registrar pedidos.");
    if (productMode === "existing" && !selectedProduct) return setError("Selecione um produto existente.");
    if (productMode !== "existing" && !productName.trim()) return setError("Informe o produto da venda.");
    if (customerMode === "existing" && !customerId) return setError("Selecione um cliente ou mude o tipo de venda.");
    if (customerMode === "new" && !customerName.trim()) return setError("Informe o nome do cliente.");

    setSaving(true);
    try {
      let resolvedProductName = selectedProduct?.name ?? productName.trim();
      let resolvedProductPrice = total;
      if (productMode === "new") {
        const catalogId = catalogsQ.data?.[0]?.id;
        if (!catalogId) throw new Error("Crie um catálogo em Produtos antes de cadastrar produto durante o pedido.");
        await saveProductFn({
          data: {
            catalogId,
            sku: "",
            name: productName.trim(),
            description: "Criado durante retirada de pedido.",
            image: "",
            price: Math.max(0, moneyToNumber(productPrice)),
            promoPrice: null,
            stock: 0,
            category: "Venda",
            active: true,
          },
        });
        resolvedProductName = productName.trim();
        resolvedProductPrice = Math.max(0, moneyToNumber(productPrice));
      }

      let name = `Venda avulsa · ${resolvedProductName}`;
      let email = "";
      let phone = "";
      let address = "";
      if (customerMode === "existing") {
        const customer = leads.find((lead) => lead.id === customerId);
        name = customer?.name ?? name;
        email = customer?.email ?? "";
        phone = customer?.phone ?? "";
      } else if (customerMode === "new") {
        name = customerName.trim();
        email = customerEmail.trim();
        phone = customerPhone.trim();
        address = customerAddress.trim();
      }

      const sourceId = sourceName.trim()
        ? (await createSourceFn({ data: { name: sourceName.trim() } })).sourceId
        : defaultSourceId;
      if (!sourceId) throw new Error("Nenhuma fonte de CRM disponível para registrar o pedido.");

      await createLeadFn({
        data: {
          crmSourceId: sourceId,
          pipelineId: defaultPipeline.id,
          stageId: defaultStageId,
          name,
          email,
          phone,
          address,
          value: total || resolvedProductPrice,
          instagramHandle: "",
          facebookUrl: "",
        },
      });
      toast.success("Pedido enviado para o funil de vendas");
      setProductId("");
      setProductName("");
      setProductPrice("");
      setCustomerId("");
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setCustomerAddress("");
      setDiscount("");
      await leadsQ.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground md:h-screen md:overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 lg:px-8">
          <header className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary"><ClipboardList className="h-4 w-4" /> Vendas</div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Pedidos</h1>
            <p className="mt-1 text-sm text-muted-foreground">Retire um pedido selecionando produto e cliente, ou registre venda avulsa sem cadastro.</p>
          </header>

          <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Produto da venda</h2>
              <Segment value={productMode} onChange={setProductMode} options={[["existing", "Produto existente"], ["new", "Criar produto"], ["free", "Venda avulsa"]]} />
              {productMode === "existing" ? (
                <Field label="Produto">
                  <select value={productId} onChange={(event) => setProductId(event.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="">Selecione um produto</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {formatBRL(product.promoPrice ?? product.price)} · estoque {product.stock}</option>)}
                  </select>
                </Field>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={productMode === "new" ? "Nome do novo produto" : "Descrição da venda"}><Input value={productName} onChange={(event) => setProductName(event.target.value)} /></Field>
                  <Field label="Valor"><Input inputMode="decimal" value={productPrice} onChange={(event) => setProductPrice(event.target.value)} /></Field>
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-[170px_1fr]">
                <Field label="Tipo de desconto">
                  <select value={discountMode} onChange={(event) => setDiscountMode(event.target.value as DiscountMode)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                    <option value="value">Valor</option>
                    <option value="percent">Porcentagem</option>
                  </select>
                </Field>
                <Field label="Desconto"><Input inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} placeholder={discountMode === "percent" ? "Ex: 10" : "Ex: 25,00"} /></Field>
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border bg-card p-4">
              <h2 className="text-sm font-semibold">Cliente</h2>
              <Segment value={customerMode} onChange={setCustomerMode} options={[["existing", "Cliente cadastrado"], ["new", "Cadastrar agora"], ["none", "Sem cadastro"]]} />
              {customerMode === "existing" ? (
                <div className="space-y-2">
                  <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} className="pl-9" placeholder="Buscar cliente" /></div>
                  <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                    {filteredLeads.map((lead) => <button key={lead.id} type="button" onClick={() => setCustomerId(lead.id)} className={`flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 ${customerId === lead.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}><span className="truncate">{lead.name}</span><span className="shrink-0 text-xs opacity-80">{lead.phone ?? lead.email ?? "sem contato"}</span></button>)}
                    {!filteredLeads.length && <div className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>}
                  </div>
                </div>
              ) : customerMode === "new" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nome"><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></Field>
                  <Field label="Telefone"><Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></Field>
                  <Field label="E-mail"><Input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></Field>
                  <Field label="Endereço"><Input value={customerAddress} onChange={(event) => setCustomerAddress(event.target.value)} /></Field>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">A venda será registrada como venda avulsa no funil.</div>
              )}
              <Field label="Fonte da venda"><Input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Opcional: cria nova fonte se preenchido" /></Field>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Total do pedido</div>
              <div className="text-3xl font-semibold tracking-tight">{formatBRL(total)}</div>
              <div className="mt-1 text-xs text-muted-foreground">Base {formatBRL(basePrice)} · desconto {formatBRL(discountValue)}</div>
            </div>
            <Button onClick={submitOrder} disabled={saving} className="h-11 gap-2"><UserPlus className="h-4 w-4" /> {saving ? "Registrando..." : "Registrar pedido"}</Button>
          </section>
          {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          {productMode === "new" && !catalogsQ.data?.length && <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"><PackagePlus className="mr-2 inline h-4 w-4" />Crie um catálogo em Produtos antes de cadastrar produto durante o pedido.</div>}
        </div>
      </main>
    </div>
  );
}

function Segment<T extends string>({ value, onChange, options }: { value: T; onChange: (value: T) => void; options: Array<[T, string]> }) {
  return <div className="flex flex-wrap gap-1 rounded-md border border-border bg-background p-1">{options.map(([id, label]) => <button key={id} type="button" onClick={() => onChange(id)} className={`h-8 rounded px-3 text-xs font-semibold transition-colors ${value === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}</button>)}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function moneyToNumber(value: string): number {
  const normalized = value.replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

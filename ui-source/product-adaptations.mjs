// Incremental adaptations of the original catalog, inventory and checkout screens.
export function adaptProducts(relative, text) {
  if (relative === 'legacy/crm.produtos.legacy.tsx') {
    text = text.replace('  price: number;', '  price: number | null; priceMode?: "fixed" | "negotiated"; kind?: "physical" | "digital-service"; trackStock?: boolean;');
    text = text.replaceAll('price: p.price,', 'price: p.price, priceMode:p.priceMode, kind:p.kind, trackStock:p.trackStock,');
    text = text.replace('price: target.price,', 'price: target.price, priceMode:target.priceMode, kind:target.kind, trackStock:target.trackStock,');
    text = text.replace('<div className="grid grid-cols-3 gap-3">', `<div className="grid gap-3 sm:grid-cols-2"><FormField label="Tipo de item"><select aria-label="Tipo de item" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.kind || "physical"} onChange={e=>setForm({...form,kind:e.target.value as any,trackStock:e.target.value === "digital-service" ? false : form.trackStock,stock:e.target.value === "digital-service" ? null : (form.stock ?? 0)})}><option value="physical">Produto físico</option><option value="digital-service">Serviço digital</option></select></FormField><FormField label="Preço do catálogo"><select aria-label="Preço do catálogo" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" value={form.priceMode || "fixed"} onChange={e=>setForm({...form,priceMode:e.target.value as any,price:e.target.value === "negotiated" ? null : (form.price ?? 0),promoPrice:undefined})}><option value="fixed">Preço fixo</option><option value="negotiated">Preço a definir na venda</option></select></FormField></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.trackStock !== false} onChange={e=>setForm({...form,trackStock:e.target.checked,stock:e.target.checked ? (form.stock ?? 0) : null})}/>Controlar estoque deste item</label><p className="text-xs text-muted-foreground">Sem controle de estoque, este item fica apenas no catálogo e nas vendas.</p><div className="grid grid-cols-3 gap-3">`);
    text = text.replace('value={form.price || ""}', 'disabled={form.priceMode === "negotiated"} value={form.price ?? ""}');
    text = text.replace('value={form.promoPrice ?? ""}', 'disabled={form.priceMode === "negotiated"} value={form.promoPrice ?? ""}');
    text = text.replace('value={form.stock || ""}', 'disabled={form.trackStock === false} value={form.stock ?? ""}');
    text = text.replace('disabled={!form.name.trim() || !form.price}', 'disabled={!form.name.trim() || (form.priceMode !== "negotiated" && (form.price == null || form.price < 0))}');
    text = text.replaceAll('{formatBRL(p.price)}', '{p.priceMode === "negotiated" ? "Preço a definir" : formatBRL(p.price ?? 0)}');
    text = text.replaceAll('{formatBRL(product.price)}', '{product.priceMode === "negotiated" ? "Preço a definir" : formatBRL(product.price ?? 0)}');
    text = text.replace('{product.stock}', '{product.trackStock === false ? "Sem estoque" : product.stock}');
  }
  if (relative === 'routes/crm.estoque.tsx') text = text.replace('catalog.products.map((product)', 'catalog.products.filter((product) => product.trackStock !== false).map((product)');
  if (relative === 'routes/pedidos.tsx') {
    text = text.replace('const basePrice = productMode === "existing" ?', 'const [salePrice,setSalePrice]=useState("");const negotiated=selectedProduct?.priceMode === "negotiated";const basePrice = productMode === "existing" && negotiated ? moneyToNumber(salePrice) : productMode === "existing" ?');
    text = text.replace('setProductId(event.target.value)', 'setProductId(event.target.value);setSalePrice("")');
    // Preserve the arrow expression when adding the second state update.
    text = text.replace('onChange={(event) => setProductId(event.target.value);setSalePrice("")}', 'onChange={(event) => {setProductId(event.target.value);setSalePrice("");}}');
    text = text.replace('{formatBRL(product.promoPrice ?? product.price)} · estoque {product.stock}', '{product.priceMode === "negotiated" ? "Preço a definir" : formatBRL(product.promoPrice ?? product.price)} · {product.trackStock === false ? "Sem controle de estoque" : "estoque " + product.stock}');
    text = text.replace('<select value={productId}', '<select aria-label="Produto" value={productId}');
    text = text.replace('<div className="grid gap-3 sm:grid-cols-[170px_1fr]">', '<>{productMode === "existing" && negotiated && <Field label="Valor combinado por unidade"><Input inputMode="decimal" value={salePrice} onChange={e=>setSalePrice(e.target.value)} placeholder="Informe o preço desta venda"/></Field>}</><div className="grid gap-3 sm:grid-cols-[170px_1fr]">');
    text = text.replace('setSaving(true);', 'if(productMode === "existing" && negotiated && (!salePrice.trim() || !Number.isFinite(Number(salePrice.replace(",","."))) || Number(salePrice.replace(",",".")) < 0))return setError("Informe o valor combinado para esta venda.");setSaving(true);');
    text = text.replace('amount: total, discount:', 'amount: total, unitPrice:basePrice, discount:');
    // New items created during checkout can also be digital services with no stock.
    text = text.replace('const [productPrice, setProductPrice] = useState("");', 'const [productPrice, setProductPrice] = useState("");const [newDigital,setNewDigital]=useState(false);');
    text = text.replace('stock: 0,', 'stock: newDigital ? null : 0, kind:newDigital ? "digital-service" : "physical",trackStock:!newDigital,');
    text = text.replace('<Field label="Tipo de desconto">', '<Field label="Tipo de desconto">');
    text = text.replace('<>{productMode === "existing"', '<>{productMode === "new" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={newDigital} onChange={e=>setNewDigital(e.target.checked)}/>Serviço digital sem estoque</label>}{productMode === "existing"');
  }
  return text;
}

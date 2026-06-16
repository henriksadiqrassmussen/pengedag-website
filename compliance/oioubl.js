
const fs=require('fs'); const path=require('path');
function esc(v){return String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
function money(v){return Number(v||0).toFixed(2);}
function generateOioUblInvoice(inv={}){
 const supplier=inv.supplier||{}, customer=inv.customer||{}, lines=inv.lines||[];
 const totalEx=lines.reduce((s,l)=>s+Number(l.qty||1)*Number(l.unitPrice||0),0);
 const vatRate=Number(inv.vatRate ?? 25); const vat=totalEx*vatRate/100; const total=totalEx+vat;
 return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Pengedag OIOUBL/NemHandel fakturakladde. Skal schematron-/CIUS-valideres og sendes via godkendt NemHandel-adgangspunkt før produktion. -->
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
 xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
 xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
 <cbc:CustomizationID>OIOUBL-2.1-DRAFT</cbc:CustomizationID>
 <cbc:ProfileID>Procurement-BilSim-1.0</cbc:ProfileID>
 <cbc:ID>${esc(inv.invoiceNo)}</cbc:ID>
 <cbc:IssueDate>${esc(inv.date||new Date().toISOString().slice(0,10))}</cbc:IssueDate>
 <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
 <cbc:DocumentCurrencyCode>DKK</cbc:DocumentCurrencyCode>
 <cbc:BuyerReference>${esc(inv.buyerReference||customer.reference||'')}</cbc:BuyerReference>
 <cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="DK:CVR">${esc(supplier.cvr)}</cbc:EndpointID><cac:PartyName><cbc:Name>${esc(supplier.name)}</cbc:Name></cac:PartyName></cac:Party></cac:AccountingSupplierParty>
 <cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="DK:GLN">${esc(customer.ean||customer.gln)}</cbc:EndpointID><cac:PartyName><cbc:Name>${esc(customer.name)}</cbc:Name></cac:PartyName></cac:Party></cac:AccountingCustomerParty>
 ${inv.orderNo?`<cac:OrderReference><cbc:ID>${esc(inv.orderNo)}</cbc:ID></cac:OrderReference>`:''}
 <cac:TaxTotal><cbc:TaxAmount currencyID="DKK">${money(vat)}</cbc:TaxAmount></cac:TaxTotal>
 <cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="DKK">${money(totalEx)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="DKK">${money(totalEx)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="DKK">${money(total)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="DKK">${money(total)}</cbc:PayableAmount></cac:LegalMonetaryTotal>
 ${lines.map((l,i)=>`<cac:InvoiceLine><cbc:ID>${i+1}</cbc:ID><cbc:InvoicedQuantity>${esc(l.qty||1)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="DKK">${money(Number(l.qty||1)*Number(l.unitPrice||0))}</cbc:LineExtensionAmount><cac:Item><cbc:Name>${esc(l.text)}</cbc:Name></cac:Item><cac:Price><cbc:PriceAmount currencyID="DKK">${money(l.unitPrice)}</cbc:PriceAmount></cac:Price></cac:InvoiceLine>`).join('\n')}
</Invoice>`;
}
function exportOioUbl(inv,outFile){fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,generateOioUblInvoice(inv));return outFile;}
module.exports={generateOioUblInvoice,exportOioUbl};

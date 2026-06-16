
const fs=require('fs'); const path=require('path');
function esc(v){return String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));}
function money(v){return Number(v||0).toFixed(2);}
function generateSaftXml(data={}){
  const company=data.company||{}; const accounts=data.accounts||[]; const entries=data.entries||[]; const attachments=data.attachments||[];
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- Pengedag SAF-T eksportkladde. Skal valideres mod den officielle danske SAF-T XSD/profil før anmeldelse. -->
<AuditFile xmlns="urn:StandardAuditFile-Taxation-Financial:DK">
  <Header>
    <AuditFileVersion>DK-SAF-T-2.0-DRAFT</AuditFileVersion>
    <CompanyID>${esc(company.cvr)}</CompanyID>
    <CompanyName>${esc(company.name)}</CompanyName>
    <TaxRegistrationNumber>${esc(company.vatNo||company.cvr)}</TaxRegistrationNumber>
    <CreationDate>${new Date().toISOString().slice(0,10)}</CreationDate>
    <SoftwareCompanyName>Pengedag</SoftwareCompanyName>
    <SoftwareID>Pengedag Vikarbureau</SoftwareID>
    <SoftwareVersion>1.1.0</SoftwareVersion>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
${accounts.map(a=>`      <Account><AccountID>${esc(a.id)}</AccountID><AccountDescription>${esc(a.name)}</AccountDescription><StandardAccountID>${esc(a.standardAccountId||'')}</StandardAccountID></Account>`).join('\n')}
    </GeneralLedgerAccounts>
  </MasterFiles>
  <GeneralLedgerEntries>
${entries.map(e=>`    <Journal><JournalID>${esc(e.journalId||'DAGBOG')}</JournalID><Transaction><TransactionID>${esc(e.id)}</TransactionID><Period>${esc(e.period||'')}</Period><TransactionDate>${esc(e.date)}</TransactionDate><Description>${esc(e.text)}</Description><Lines>${(e.lines||[]).map((l,i)=>`<Line><RecordID>${esc(e.id)}-${i+1}</RecordID><AccountID>${esc(l.account)}</AccountID><DebitAmount>${money(l.debit)}</DebitAmount><CreditAmount>${money(l.credit)}</CreditAmount><TaxInformation><TaxType>${esc(l.vatCode||'')}</TaxType><TaxAmount>${money(l.vatAmount)}</TaxAmount></TaxInformation></Line>`).join('')}</Lines></Transaction></Journal>`).join('\n')}
  </GeneralLedgerEntries>
  <SourceDocuments>
${attachments.map(b=>`    <SourceDocument><DocumentNumber>${esc(b.id)}</DocumentNumber><DocumentDate>${esc(b.date)}</DocumentDate><DocumentType>${esc(b.type||'BILAG')}</DocumentType><DocumentLocation>${esc(b.path)}</DocumentLocation><DocumentHash>${esc(b.sha256)}</DocumentHash></SourceDocument>`).join('\n')}
  </SourceDocuments>
</AuditFile>`;
}
function parseSaftXml(xml){
  // Minimal import-/valideringskladde: fuld produktion kræver XSD-validering og mapping til dansk standardkontoplan.
  const entries=[...String(xml).matchAll(/<TransactionID>(.*?)<\/TransactionID>[\s\S]*?<TransactionDate>(.*?)<\/TransactionDate>[\s\S]*?<Description>(.*?)<\/Description>/g)].map(m=>({id:m[1],date:m[2],text:m[3]}));
  return {ok:true,warning:'Minimal SAF-T import. Valider mod officiel dansk SAF-T profil før brug.',entries};
}
function exportSaft(data,outFile){ fs.mkdirSync(path.dirname(outFile),{recursive:true}); fs.writeFileSync(outFile,generateSaftXml(data)); return outFile; }
module.exports={generateSaftXml,parseSaftXml,exportSaft};

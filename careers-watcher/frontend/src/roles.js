export const ROLE_DEFS = [
  { key: "backend",  label: "Backend",  kws: ["backend","back end","server","api","microservice","distributed","scala","go","golang","java","python","node","spring","fastapi","django"] },
  { key: "frontend", label: "Frontend", kws: ["frontend","front end","react","vue","angular","next.js","ui","ux","web"] },
  { key: "fullstack",label: "Full-stack",kws: ["full stack","full-stack","fullstack"] },
  { key: "data",     label: "Data Eng", kws: ["data engineer","etl","spark","kafka","warehouse","dbt","hadoop","airflow"] },
  { key: "ml",       label: "ML / AI",  kws: ["machine learning","ml","ai","deep learning","llm","nlp","vision","cv","mle"] },
  { key: "devops",   label: "DevOps",   kws: ["devops","platform","infra","infrastructure","kubernetes","k8s","terraform","ci","cd","argo","spinnaker"] },
  { key: "sre",      label: "SRE",      kws: ["sre","site reliability","reliability"] },
  { key: "mobile",   label: "Mobile",   kws: ["ios","android","swift","kotlin","react native"] },
  { key: "security", label: "Security", kws: ["security","appsec","infosec","iam","threat","vuln","pentest"] },
  { key: "qa",       label: "QA / SDET",kws: ["qa","quality","test","testing","sdet"] },
  { key: "platform", label: "Platform", kws: ["platform","core services","foundation"] },
];

export function matchesSelectedRoles(job, selected) {
  if (selected.length === 0) return true;
  const text = `${job.title} ${job.department}`.toLowerCase();
  return selected.some((k) => (ROLE_DEFS.find((r) => r.key === k)?.kws || []).some((kw) => text.includes(kw)));
}

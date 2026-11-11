export interface Region {
  code: string;
  name: string;
  iso: string;
  basePing: number;
  relaySample: string;
  exitSample: string;
  nodeCount: number;
}

export const REGIONS: Region[] = [
  { code: "US", name: "United States", iso: "us", basePing: 24, relaySample: "public-vpn-89.opengw.net", exitSample: "104.238.171.54", nodeCount: 612 },
  { code: "CA", name: "Canada", iso: "ca", basePing: 31, relaySample: "public-vpn-204.opengw.net", exitSample: "99.79.64.112", nodeCount: 148 },
  { code: "AU", name: "Australia", iso: "au", basePing: 187, relaySample: "public-vpn-133.opengw.net", exitSample: "139.99.228.40", nodeCount: 37 },
  { code: "BR", name: "Brazil", iso: "br", basePing: 118, relaySample: "public-vpn-171.opengw.net", exitSample: "177.54.152.21", nodeCount: 54 },
  { code: "KR", name: "South Korea", iso: "kr", basePing: 151, relaySample: "public-vpn-066.opengw.net", exitSample: "121.135.84.199", nodeCount: 96 },
  { code: "VN", name: "Vietnam", iso: "vn", basePing: 172, relaySample: "public-vpn-152.opengw.net", exitSample: "14.225.3.76", nodeCount: 41 },
  { code: "JP", name: "Japan", iso: "jp", basePing: 139, relaySample: "public-vpn-219.opengw.net", exitSample: "126.76.194.71", nodeCount: 388 },
  { code: "GB", name: "United Kingdom", iso: "gb", basePing: 42, relaySample: "public-vpn-237.opengw.net", exitSample: "185.73.44.9", nodeCount: 129 },
  { code: "DE", name: "Germany", iso: "de", basePing: 38, relaySample: "public-vpn-103.opengw.net", exitSample: "159.69.35.180", nodeCount: 154 },
  { code: "FR", name: "France", iso: "fr", basePing: 45, relaySample: "public-vpn-187.opengw.net", exitSample: "51.38.115.226", nodeCount: 103 },
  { code: "IN", name: "India", iso: "in", basePing: 129, relaySample: "public-vpn-245.opengw.net", exitSample: "103.148.74.52", nodeCount: 68 },
  { code: "CN", name: "China", iso: "cn", basePing: 211, relaySample: "public-vpn-107.opengw.net", exitSample: "103.235.46.39", nodeCount: 19 },
];

export const jitter = (base: number) =>
  Math.max(4, Math.round(base + (Math.random() - 0.4) * base * 0.18));

export const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

export const fmtMbps = (v: number) => v.toFixed(1);

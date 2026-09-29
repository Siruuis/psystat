const PATHS: Record<string, string> = {
  new: "M6 2h7l5 5v15H6zM13 2v5h5",
  open: "M3 6h6l2 2h10v11H3z",
  save: "M4 3h13l3 3v15H4zM8 3v6h8V3M8 21v-6h8v6",
  print: "M6 9V3h12v6M6 18H4v-6h16v6h-2M8 14h8v7H8z",
  undo: "M9 7L4 12l5 5M4 12h11a5 5 0 0 1 0 10h-2",
  redo: "M15 7l5 5-5 5M20 12H9a5 5 0 0 0 0 10h2",
  insertCol: "M4 4h6v16H4zM14 8v8M18 12h-8",
  insertRow: "M4 4h16v6H4zM8 14h8M12 18v-8",
  sortAsc: "M7 4v16M7 4l-3 3M7 4l3 3M13 6h8M13 12h5M13 18h2",
  sortDesc: "M7 20V4M7 20l-3-3M7 20l3-3M13 6h2M13 12h5M13 18h8",
  labels: "M4 6h10l4 6-4 6H4zM16 12h4",
  compute: "M6 3h12v4H6zM8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h8",
  run: "M8 5v14l11-7z",
  find: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4-4",
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

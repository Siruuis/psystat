import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label?: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
  submenu?: MenuItem[];
}

export interface Menu {
  label: string;
  items: MenuItem[];
}

function ItemRow({ item, onRun }: { item: MenuItem; onRun: () => void }) {
  const [open, setOpen] = useState(false);
  if (item.separator) return <div className="menu-sep" />;
  if (item.submenu) {
    return (
      <div className="menu-item has-sub" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
        <span>{item.label}</span>
        <span className="sub-arrow">▸</span>
        {open && (
          <div className="submenu">
            {item.submenu.map((sub, i) => (
              <ItemRow key={i} item={sub} onRun={onRun} />
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <button
      className="menu-item"
      disabled={item.disabled}
      onClick={() => {
        item.onClick?.();
        onRun();
      }}
    >
      <span>{item.label}</span>
      {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
    </button>
  );
}

export function MenuBar({ menus }: { menus: Menu[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenIndex(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="menubar" ref={ref}>
      {menus.map((menu, i) => (
        <div key={menu.label} className="menubar-root">
          <button
            className={`menubar-label ${openIndex === i ? "open" : ""}`}
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            onMouseEnter={() => openIndex !== null && setOpenIndex(i)}
          >
            {menu.label}
          </button>
          {openIndex === i && (
            <div className="menu-panel">
              {menu.items.map((item, j) => (
                <ItemRow key={j} item={item} onRun={() => setOpenIndex(null)} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

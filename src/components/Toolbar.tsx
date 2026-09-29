import { Icon } from "./Icon";

export interface ToolButton {
  icon: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  separatorAfter?: boolean;
}

export function Toolbar({ buttons }: { buttons: ToolButton[] }) {
  return (
    <div className="toolbar">
      {buttons.map((b, i) => (
        <span key={i} className="tool-wrap">
          <button
            className={`tool ${b.active ? "active" : ""}`}
            title={b.title}
            disabled={b.disabled}
            onClick={b.onClick}
          >
            <Icon name={b.icon} />
          </button>
          {b.separatorAfter && <span className="tool-sep" />}
        </span>
      ))}
    </div>
  );
}

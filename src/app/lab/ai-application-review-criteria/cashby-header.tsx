import Link from "next/link";
import { css, cx } from "../../../../styled-system/css";
import LogoMark from "./icons/logo.svg";
import HomeIcon from "./icons/home.svg";
import NavSeparator from "./icons/separator-nav.svg";
import MenuChevron from "./icons/chevron-small-down-ink.svg";
import SearchIcon from "./icons/search.svg";
import AddChevron from "./icons/chevron-small-down-white.svg";
import BellIcon from "./icons/notification-bell.svg";
import HelpIcon from "./icons/question-mark.svg";
import AccountSeparator from "./icons/separator-account.svg";
import AccountChevron from "./icons/chevron-small-down-account.svg";

// Scenery, drawn as text rather than dead controls a keyboard would tab through; only Home links.

const SECTIONS = [
  { label: "Pipeline", menu: false },
  { label: "Candidates", menu: true },
  { label: "Jobs", menu: true },
  { label: "Sourcing", menu: true },
  { label: "Reports", menu: true },
  { label: "Dashboard", menu: true },
  { label: "Admin", menu: false },
] as const;

const barStyle = css({
  position: "sticky",
  insetBlockStart: 0,
  zIndex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "8px",
  flexShrink: 0,
  height: "52px",
  paddingBlock: "10px",
  paddingInline: "20px",
  backgroundColor: "var(--cashby-bar)",
  borderBlockEndWidth: "var(--cashby-rule)",
  borderBlockEndStyle: "solid",
  borderBlockEndColor: "var(--cashby-hairline)",
});

const groupStyle = css({ display: "flex", alignItems: "center", gap: "8px" });

const leadingStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  minWidth: 0,
  overflow: "hidden",
});

const brandStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  flexShrink: 0,
  width: "68px",
  height: "40px",
});

const logoTileStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "32px",
  height: "32px",
  paddingInline: "4px",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-accent)",
  // Paints the mark: SVGR turns its white into `currentColor`.
  color: "var(--cashby-surface)",
});

const iconTileStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  width: "28px",
  height: "28px",
  borderRadius: "4px",
});

const homeLinkStyle = css({
  color: "inherit",
  _hover: { backgroundColor: "var(--cashby-fill)" },
  _focusVisible: { outline: "none", boxShadow: "var(--cashby-focus-ring)" },
});

const separatorStyle = css({ position: "relative", flexShrink: 0, width: 0 });
const navSeparatorStyle = css({ height: "28px" });
const accountSeparatorStyle = css({ height: "32px" });
const separatorLineStyle = css({
  position: "absolute",
  insetBlockStart: "-0.25px",
  insetInlineStart: "-0.25px",
});

const sectionsStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "12px",
  paddingInline: "4px",
});

const sectionStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "2px",
  flexShrink: 0,
  font: "var(--cashby-text-label)",
  whiteSpace: "nowrap",
});

const searchStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
  width: "160px",
  height: "28px",
  paddingInline: "4px",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-fill)",
});

const searchPlaceholderStyle = css({
  flex: 1,
  minWidth: 0,
  font: "var(--cashby-text-small)",
  color: "var(--cashby-ink-muted)",
});

const hotkeyStyle = css({
  display: "flex",
  alignItems: "center",
  height: "20px",
  paddingInline: "4px",
  borderRadius: "4px",
  borderWidth: "var(--cashby-rule)",
  borderStyle: "solid",
  borderColor: "var(--cashby-hairline)",
  backgroundColor: "var(--cashby-hairline)",
  font: "var(--cashby-text-small)",
  whiteSpace: "nowrap",
});

const addStyle = css({
  display: "flex",
  alignItems: "center",
  flexShrink: 0,
  height: "28px",
  paddingInlineStart: "6px",
  paddingInlineEnd: "2px",
  borderRadius: "8px",
  backgroundColor: "var(--cashby-accent)",
  color: "var(--cashby-surface)",
  font: "var(--cashby-text-label)",
});

const addLabelStyle = css({ minWidth: "32px", textAlign: "center" });

const utilitiesStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "2px",
});

const accountStyle = css({
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexShrink: 0,
});

const avatarStyle = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  borderRadius: "16px",
  backgroundColor: "var(--cashby-accent-wash)",
  color: "var(--cashby-accent)",
  font: "var(--cashby-text-body)",
});

const accountNameStyle = css({
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  whiteSpace: "nowrap",
  font: "var(--cashby-text-label)",
});

const accountOrgStyle = css({
  font: "var(--cashby-text-fine)",
  color: "var(--cashby-ink-muted)",
});

export function CashbyHeader() {
  return (
    <header className={barStyle}>
      <div className={leadingStyle}>
        <div className={brandStyle}>
          <span className={logoTileStyle}>
            <LogoMark aria-hidden />
          </span>
          <Link
            href="/"
            aria-label="Home"
            className={cx(iconTileStyle, homeLinkStyle)}
          >
            <HomeIcon aria-hidden />
          </Link>
        </div>
        <span className={cx(separatorStyle, navSeparatorStyle)} aria-hidden>
          <NavSeparator className={separatorLineStyle} />
        </span>
        <div className={sectionsStyle}>
          {SECTIONS.map(({ label, menu }) => (
            <span key={label} className={sectionStyle}>
              {label}
              {menu && <MenuChevron aria-hidden />}
            </span>
          ))}
        </div>
      </div>

      <div className={groupStyle}>
        <div className={searchStyle}>
          <SearchIcon aria-hidden />
          <span className={searchPlaceholderStyle}>Search...</span>
          <kbd className={hotkeyStyle}>⌘K</kbd>
        </div>
        <span className={addStyle}>
          <span className={addLabelStyle}>Add</span>
          <AddChevron aria-hidden />
        </span>
        <div className={utilitiesStyle} aria-hidden>
          <span className={iconTileStyle}>
            <BellIcon />
          </span>
          <span className={iconTileStyle}>
            <HelpIcon />
          </span>
        </div>
        <span className={cx(separatorStyle, accountSeparatorStyle)} aria-hidden>
          <AccountSeparator className={separatorLineStyle} />
        </span>
        <div className={accountStyle}>
          <span className={avatarStyle} aria-hidden>
            JP
          </span>
          <span className={accountNameStyle}>
            <span>Jessica Pilz</span>
            <span className={accountOrgStyle}>Cashby Incorporated</span>
          </span>
          <AccountChevron aria-hidden />
        </div>
      </div>
    </header>
  );
}

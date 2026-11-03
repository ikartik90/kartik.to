"use client";

import { use, useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import Image, { type StaticImageData } from "next/image";
import { css } from "../../../../styled-system/css";
import { TIMEZONES, zoneAt, type Team, type TeamDetails } from "./activations";
import { Avatar } from "./data-table";
import { Dropdown } from "./dropdown";
import { RangeType } from "./filters";
import type { Place } from "./geofence";
import { MAX_ZOOM, MIN_ZOOM, clampOffset, sourceOf, spanOf, type Offset, type Size } from "./logo-crop";
import { ADDRESS, AddressSearch } from "./preset-sheet";
import { Button, Field, Overlay, Presence, ScrimContext, TextInput, Typography, alertIf, keepFocusIn } from "./ui";
import UploadIcon from "./assets/icons/small/upload.svg";

// SW Curie's Edit Team (18783:14255), and New team as it: the team's logo over its name, address and timezone.

// A logo form's body, Edit company workspace's too: Figma's fields stand 72px in from the overlay's sides.
export const logoFormBodyStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-3xl)",
  paddingBlock: "var(--sw-padding-3xl)",
  paddingInline: "calc(var(--sw-padding-3xl) * 3)",
});

const logoStyle = css({ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--sw-gap-md)" });

const pickerStyle = css({ srOnly: true });

// Figma's crop (12231:28379): 330 wide, its picture and zoom 215 across, a large company Avatar's shape three times over.
const cropOverlayRaw = css.raw({ width: "20.625rem" });

const cropBodyStyle = css({
  display: "flex",
  flexDirection: "column",
  gap: "var(--sw-gap-xl)",
  width: "13.5rem",
  marginInline: "auto",
  paddingBlockStart: "var(--sw-padding-xl)",
});

const cropStyle = css({
  position: "relative",
  width: "13.5rem",
  height: "13.5rem",
  overflow: "hidden",
  borderRadius: "calc(var(--sw-radius-md) * 3)",
  outline: "0.5px solid var(--sw-border-subdued)",
  outlineOffset: "-0.5px",
  touchAction: "none",
  userSelect: "none",
  "& > span": { position: "absolute", pointerEvents: "none" },
});

// The crop's picture, drawn this many pixels square: four times a large Avatar.
const CROPPED = 288;

/**
 * Molecules/Overlay's crop for a logo just uploaded, titled `title` and hung to the right of `trigger`: `picture` in a
 * company Avatar's shape, zoomed from just covering it and dragged about inside it, saved as the square that shows.
 */
function LogoCrop({
  picture,
  title,
  trigger,
  onCancel,
  onSave,
}: {
  picture: StaticImageData | string;
  title: string;
  trigger: HTMLElement | null;
  onCancel: () => void;
  onSave: (logo: string) => void;
}) {
  const src = typeof picture === "string" ? picture : picture.src;
  const [size, setSize] = useState<Size | null>(typeof picture === "string" ? null : picture);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; from: Offset } | null>(null);
  const body = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLImageElement>(null);
  // Square till it's loaded.
  const shape = size ?? { width: 1, height: 1 };
  const span = spanOf(shape, zoom);

  useEffect(() => body.current?.querySelector<HTMLElement>("[role=slider]")?.focus({ preventScroll: true }), []);

  const press = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDrag({ x: event.clientX, y: event.clientY, from: offset });
  };

  // In the crop's sides, which the window's scale doesn't change.
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const side = event.currentTarget.getBoundingClientRect().width || 1;
    const by = { x: (event.clientX - drag.x) / side, y: (event.clientY - drag.y) / side };
    setOffset(clampOffset(shape, zoom, { x: drag.from.x + by.x, y: drag.from.y + by.y }));
  };

  const save = () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = CROPPED;
    const context = canvas.getContext("2d");
    if (!context || !image.current) return onSave(src);
    const from = sourceOf(shape, zoom, offset);
    context.drawImage(image.current, from.x, from.y, from.side, from.side, 0, 0, CROPPED, CROPPED);
    onSave(canvas.toDataURL("image/png"));
  };

  return (
    <Overlay label={title} trigger={trigger} beside onClose={onCancel} css={cropOverlayRaw} onKeyDown={keepFocusIn}>
      <Overlay.Header>
        <Typography variant="heading">{title}</Typography>
        <Overlay.Close />
      </Overlay.Header>
      <div ref={body} className={cropBodyStyle}>
        <div
          role="img"
          aria-label="Logo position"
          className={cropStyle}
          onPointerDown={press}
          onPointerMove={move}
          onPointerUp={() => setDrag(null)}
          onPointerCancel={() => setDrag(null)}
        >
          <span
            style={{
              width: `${span.width * 100}%`,
              height: `${span.height * 100}%`,
              left: `${(0.5 - span.width / 2 + offset.x) * 100}%`,
              top: `${(0.5 - span.height / 2 + offset.y) * 100}%`,
            }}
          >
            <Image
              ref={image}
              src={picture}
              alt=""
              fill
              unoptimized
              draggable={false}
              onLoad={(event) => setSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            />
          </span>
        </div>
        <RangeType
          type="continuous"
          single
          trackOnly
          smooth
          aria-label="Zoom"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          value={[MIN_ZOOM, zoom]}
          onChange={([, to]) => {
            setZoom(to);
            setOffset((now) => clampOffset(shape, to, now));
          }}
        />
      </div>
      <Overlay.ActionBar>
        <Overlay.Cancel />
        <Overlay.ForwardActions>
          <Button emphasis="secondary" onClick={save}>
            Save logo
          </Button>
        </Overlay.ForwardActions>
      </Overlay.ActionBar>
    </Overlay>
  );
}

/**
 * A form's logo over its fields: its `Avatar`, and the button named `label` that uploads a picture for it, `upload`
 * without asking for a file where it's given, to crop in the overlay titled `title` to the Avatar's right.
 */
export function LogoPicker({
  logo,
  label,
  title,
  upload,
  onChange,
}: {
  logo?: StaticImageData | string;
  label: string;
  title: string;
  upload?: StaticImageData;
  onChange: (logo: string) => void;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  // In a modal, the crop hangs from its scrim, so the form's body doesn't clip it.
  const scrim = use(ScrimContext);
  const [picked, setPicked] = useState<{ picture: StaticImageData | string; avatar: HTMLElement | null } | null>(null);
  const crop = (picture: StaticImageData | string) =>
    setPicked({ picture, avatar: root.current?.querySelector<HTMLElement>("[data-avatar]") ?? null });
  const close = () => {
    setPicked(null);
    document.getElementById(id)?.focus({ preventScroll: true });
  };
  const overlay = (
    <Presence>
      {picked && (
        <LogoCrop
          picture={picked.picture}
          title={title}
          trigger={picked.avatar}
          onCancel={close}
          onSave={(cropped) => {
            onChange(cropped);
            close();
          }}
        />
      )}
    </Presence>
  );
  return (
    <div ref={root} className={logoStyle}>
      <Avatar type="company" size="large" src={logo} />
      <Button id={id} size="small" emphasis="tertiary" onClick={() => (upload ? crop(upload) : picker.current?.click())}>
        <UploadIcon aria-hidden />
        {label}
      </Button>
      <input
        ref={picker}
        type="file"
        accept="image/*"
        className={pickerStyle}
        tabIndex={-1}
        aria-hidden
        aria-labelledby={id}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file?.type.startsWith("image/")) crop(URL.createObjectURL(file));
          event.target.value = "";
        }}
      />
      {scrim ? createPortal(overlay, scrim) : overlay}
    </div>
  );
}

type Draft = { name: string; address: Place | null; zone: string; logo?: StaticImageData | string };

/** New team, or Edit team once it's given the team. */
export function TeamForm({
  team,
  inherited,
  height,
  onCancel,
  onSave,
}: {
  team?: Team;
  /** Its company's logo, shown until the team has its own. */
  inherited?: StaticImageData | string;
  /** The app's, which the form fits in. */
  height: number;
  onCancel: () => void;
  onSave: (details: TeamDetails) => void;
}) {
  const [draft, setDraft] = useState<Draft>(
    team ? { name: team.name, address: team.address, zone: team.zone, logo: team.logo } : { name: "", address: null, zone: "" },
  );
  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const [tried, setTried] = useState(false);
  const title = team ? "Edit team" : "New team";

  const save = () => {
    const { name, address, zone, logo } = draft;
    if (name.trim() && address && zone) onSave({ name: name.trim(), address, zone, logo });
    else setTried(true);
  };

  return (
    <Overlay label={title} onClose={onCancel} height={height} scrim="light" holds>
      <Overlay.Header>
        <Typography variant="heading">{title}</Typography>
        <Overlay.Close />
      </Overlay.Header>
      <div className={logoFormBodyStyle}>
        <LogoPicker
          logo={draft.logo ?? inherited}
          label={team || inherited ? "Update team logo" : "Add team logo"}
          title="Team logo"
          onChange={(logo) => set({ logo })}
        />
        <Field tone={alertIf(tried, !draft.name.trim())}>
          <Field.Label>Team Name</Field.Label>
          <TextInput value={draft.name} onChange={(name) => set({ name })} />
        </Field>
        <Field tone={alertIf(tried, !draft.address)}>
          <Field.Label>{`Team ${ADDRESS}`}</Field.Label>
          <AddressSearch
            value={draft.address}
            onChange={(address) => {
              const zone = address && zoneAt(address);
              set(zone ? { address, zone } : { address });
            }}
          />
        </Field>
        <Field tone={alertIf(tried, !draft.zone)}>
          <Field.Label>Default Timezone</Field.Label>
          <Dropdown value={draft.zone} onChange={(zone) => set({ zone })}>
            {TIMEZONES.map((zone) => (
              <Dropdown.Item key={zone} value={zone}>
                <Typography variant="bodyLarge">{zone}</Typography>
              </Dropdown.Item>
            ))}
          </Dropdown>
        </Field>
      </div>
      <Overlay.ActionBar>
        <Overlay.Cancel />
        <Overlay.ForwardActions>
          <Button onClick={save}>{team ? "Save changes" : "Add team"}</Button>
        </Overlay.ForwardActions>
      </Overlay.ActionBar>
    </Overlay>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type QRCodeStyling from "qr-code-styling";
import styles from "./QRStudio.module.scss";

type QRDesign = {
  foregroundColor: string;
  backgroundColor: string;
  dotsType: string;
  cornersSquareType: string;
  cornersDotType: string;
  errorCorrectionLevel: string;
  frameStyle: string | null;
  frameText: string | null;
  logoUrl: string | null;
};

type Props = {
  cardId: string;
  slug: string;
  profileUrl: string;
  initialDesign: QRDesign;
  profileImageUrl: string | null;
  companyLogoUrl: string | null;
};

const DOT_STYLES = ["square", "dots", "rounded", "classy", "classy-rounded", "extra-rounded"] as const;
const CORNER_STYLES = ["square", "dot", "extra-rounded"] as const;
type DotStyle = (typeof DOT_STYLES)[number];
type CornerStyle = (typeof CORNER_STYLES)[number];
type CorrectionLevel = "L" | "M" | "Q" | "H";
type FrameStyle = "none" | "label" | "border";
type LogoChoice = "none" | "profile" | "company";

export default function QRStudio({
  cardId,
  slug,
  profileUrl,
  initialDesign,
  profileImageUrl,
  companyLogoUrl,
}: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<QRCodeStyling | null>(null);
  const [foregroundColor, setForegroundColor] = useState(initialDesign.foregroundColor);
  const [backgroundColor, setBackgroundColor] = useState(initialDesign.backgroundColor);
  const [dotsType, setDotsType] = useState<DotStyle>(initialDesign.dotsType as DotStyle);
  const [cornersSquareType, setCornersSquareType] = useState<CornerStyle>(initialDesign.cornersSquareType as CornerStyle);
  const [cornersDotType, setCornersDotType] = useState<"square" | "dot">(initialDesign.cornersDotType as "square" | "dot");
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<CorrectionLevel>(initialDesign.errorCorrectionLevel as CorrectionLevel);
  const [frameStyle, setFrameStyle] = useState<FrameStyle>((initialDesign.frameStyle || "none") as FrameStyle);
  const [frameText, setFrameText] = useState(initialDesign.frameText || "SCAN TO CONNECT");
  const [logoChoice, setLogoChoice] = useState<LogoChoice>(
    initialDesign.logoUrl && initialDesign.logoUrl === companyLogoUrl
      ? "company"
      : initialDesign.logoUrl && initialDesign.logoUrl === profileImageUrl ? "profile" : "none",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  const logoUrl = logoChoice === "company" ? companyLogoUrl : logoChoice === "profile" ? profileImageUrl : null;

  useEffect(() => {
    let active = true;
    const options = {
      width: 320,
      height: 320,
      type: "svg" as const,
      data: profileUrl + "?source=qr",
      margin: 12,
      qrOptions: { errorCorrectionLevel },
      image: logoUrl || undefined,
      imageOptions: { hideBackgroundDots: true, imageSize: 0.26, margin: 7, crossOrigin: "anonymous" as const },
      dotsOptions: { color: foregroundColor, type: dotsType },
      backgroundOptions: { color: backgroundColor },
      cornersSquareOptions: { color: foregroundColor, type: cornersSquareType },
      cornersDotOptions: { color: foregroundColor, type: cornersDotType },
    };

    import("qr-code-styling").then(({ default: QRCodeStylingConstructor }) => {
      if (!active || !previewRef.current) return;
      if (!qrRef.current) {
        qrRef.current = new QRCodeStylingConstructor(options);
        qrRef.current.append(previewRef.current);
      } else {
        qrRef.current.update(options);
      }
      setReady(true);
    }).catch(() => setMessage("The QR preview could not be loaded. Refresh the page and try again."));

    return () => { active = false; };
  }, [profileUrl, foregroundColor, backgroundColor, dotsType, cornersSquareType, cornersDotType, errorCorrectionLevel, logoUrl]);

  async function saveDesign() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/cards/" + cardId + "/qr", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foregroundColor,
          backgroundColor,
          dotsType,
          cornersSquareType,
          cornersDotType,
          errorCorrectionLevel,
          frameStyle,
          frameText,
          logoChoice,
        }),
      });
      if (!response.ok) throw new Error("Unable to save");
      setMessage("QR design saved.");
    } catch {
      setMessage("Could not save your QR design. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function download(extension: "png" | "svg") {
    if (!qrRef.current) return;
    await qrRef.current.download({ name: "vcard-" + slug, extension });
  }

  return (
    <section className={styles.studio}>
      <div className={styles.intro}>
        <div><span>QR DESIGNER</span><h2>Your permanent QR code</h2><p>This code opens your public profile. Your QR stays valid when you update your card details or design.</p></div>
        <code>{profileUrl}</code>
      </div>
      <div className={styles.layout}>
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <h3>Colors</h3>
            <label>QR color <input type="color" value={foregroundColor} onChange={(event) => setForegroundColor(event.target.value)} /></label>
            <label>Background <input type="color" value={backgroundColor} onChange={(event) => setBackgroundColor(event.target.value)} /></label>
          </div>
          <div className={styles.controlGroup}>
            <h3>Pattern</h3>
            <label>Dot style
              <select value={dotsType} onChange={(event) => setDotsType(event.target.value as DotStyle)}>
                {DOT_STYLES.map((value) => <option key={value} value={value}>{value.replaceAll("-", " ")}</option>)}
              </select>
            </label>
            <label>Corner frame
              <select value={cornersSquareType} onChange={(event) => setCornersSquareType(event.target.value as CornerStyle)}>
                {CORNER_STYLES.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>Corner dot
              <select value={cornersDotType} onChange={(event) => setCornersDotType(event.target.value as "square" | "dot")}>
                {["square", "dot"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>Error correction
              <select value={errorCorrectionLevel} onChange={(event) => setErrorCorrectionLevel(event.target.value as CorrectionLevel)}>
                <option value="L">Low</option><option value="M">Medium</option><option value="Q">Quartile</option><option value="H">High (recommended with logo)</option>
              </select>
            </label>
          </div>
          <div className={styles.controlGroup}>
            <h3>Center logo</h3>
            <label>Logo image
              <select value={logoChoice} onChange={(event) => setLogoChoice(event.target.value as LogoChoice)}>
                <option value="none">No logo</option>
                <option value="profile" disabled={!profileImageUrl}>Profile photo</option>
                <option value="company" disabled={!companyLogoUrl}>Company logo</option>
              </select>
            </label>
            <p className={styles.hint}>Upload a profile photo or company logo in the branding section first. High error correction is recommended when using a logo.</p>
          </div>
          <div className={styles.controlGroup}>
            <h3>Frame</h3>
            <label>Frame style
              <select value={frameStyle} onChange={(event) => setFrameStyle(event.target.value as FrameStyle)}>
                <option value="none">No frame</option><option value="label">Label below preview</option><option value="border">Simple border</option>
              </select>
            </label>
            <label>Frame text
              <input value={frameText} maxLength={40} onChange={(event) => setFrameText(event.target.value)} />
            </label>
          </div>
          <button className={styles.saveButton} type="button" onClick={saveDesign} disabled={saving}>{saving ? "Saving…" : "Save QR design"}</button>
          {message && <p className={styles.message} role="status">{message}</p>}
        </div>
        <div className={styles.previewColumn}>
          <div className={styles.previewCard + " " + (frameStyle === "border" ? styles.framed : "")}>
            <div className={styles.qrPreview} ref={previewRef} />
            {frameStyle === "label" && <strong>{frameText || "SCAN TO CONNECT"}</strong>}
          </div>
          <p className={styles.previewHint}>Scan with a phone camera to open this profile.</p>
          <div className={styles.downloads}>
            <button type="button" onClick={() => download("png")} disabled={!ready}>Download PNG</button>
            <button type="button" onClick={() => download("svg")} disabled={!ready}>Download SVG</button>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { FormStatus, SubmitButton, fieldClassName, labelClassName, secondaryButtonClassName } from "@/components/auth/form-ui";
import { previewMissionAction, redeemMissionAction } from "@/lib/missions/actions";
import { formatCode, isValidCode, parseScannedRedeemUrl, type MissionPreview } from "@/lib/missions/schema";
import { OPERATIONAL_TIME_ZONE } from "@/lib/time-zone";

const dateFormat = new Intl.DateTimeFormat("es-SV", { dateStyle: "medium", timeStyle: "short", timeZone: OPERATIONAL_TIME_ZONE });

const STATE_MESSAGES: Readonly<Record<MissionPreview["state"], string | null>> = {
  available: null,
  disabled: "Esta misión no está activa.",
  expired: "Esta misión ya venció.",
  not_started: "Esta misión aún no ha comenzado.",
  redeemed: "Ya canjeaste esta misión.",
};

interface DetectorLike {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}

/**
 * Code entry and optional QR scanning. Opening a link never redeems: the
 * participant always sees the mission and confirms explicitly.
 */
export function RedeemPanel({ initialCode, origin }: { initialCode: string | null; origin: string }) {
  const [code, setCode] = useState(initialCode ?? "");
  const [channel, setChannel] = useState<"manual" | "qr">(initialCode ? "qr" : "manual");
  const [preview, setPreview] = useState<MissionPreview | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [pending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loadedInitial = useRef(false);

  function check(value: string, via: "manual" | "qr") {
    setMessage(null);
    setPreview(null);

    if (!isValidCode(value)) {
      setMessage({ text: "Escribe un código de 8 caracteres (por ejemplo 7F38-Z6DM).", tone: "error" });
      return;
    }

    setChannel(via);
    startTransition(async () => {
      const result = await previewMissionAction(value);

      if (result.reward) {
        setPreview(result.reward);
      } else {
        setMessage({ text: result.message ?? "Código no válido.", tone: "error" });
      }
    });
  }

  // A QR link (?c=) only pre-loads the mission; redeeming still needs a click.
  useEffect(() => {
    if (initialCode && !loadedInitial.current) {
      loadedInitial.current = true;
      const timer = window.setTimeout(() => check(initialCode, "qr"), 0);
      return () => window.clearTimeout(timer);
    }
  });

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => stopCamera, []);

  async function startCamera() {
    setMessage(null);
    const Detector = (globalThis as { BarcodeDetector?: new (options: { formats: string[] }) => DetectorLike }).BarcodeDetector;

    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setMessage({
        text: "Tu navegador no puede escanear aquí. Abre la cámara de tu teléfono y apunta al QR, o escribe el código.",
        tone: "error",
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
      streamRef.current = stream;
      setScanning(true);
      const detector = new Detector({ formats: ["qr_code"] });

      window.requestAnimationFrame(async function loop() {
        const video = videoRef.current;

        if (!streamRef.current) {
          return;
        }

        // The <video> mounts on the next render; keep polling until it exists.
        if (!video) {
          window.requestAnimationFrame(loop);
          return;
        }

        if (video.srcObject !== stream) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }

        const found = await detector.detect(video).catch(() => []);
        const raw = found[0]?.rawValue;

        if (raw) {
          const scannedCode = parseScannedRedeemUrl(origin, raw);
          stopCamera();

          if (scannedCode) {
            setCode(scannedCode);
            check(scannedCode, "qr");
          } else {
            setMessage({ text: "QR no válido: no pertenece a esta campaña.", tone: "error" });
          }

          return;
        }

        window.requestAnimationFrame(loop);
      });
    } catch {
      stopCamera();
      setMessage({ text: "No pudimos usar la cámara. Revisa el permiso o escribe el código.", tone: "error" });
    }
  }

  function redeem() {
    startTransition(async () => {
      const result = await redeemMissionAction(code, channel);

      if (result.status === "success") {
        setPreview(null);
        setCode("");
        setMessage({ text: `¡Misión completada! Sumaste ${result.points} puntos por «${result.name}».`, tone: "success" });
      } else {
        setMessage({ text: result.message, tone: "error" });
      }
    });
  }

  const blocked = preview ? STATE_MESSAGES[preview.state] : null;

  return (
    <div className="space-y-6">
      {message ? <FormStatus tone={message.tone}>{message.text}</FormStatus> : null}

      <form
        className="space-y-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          check(code, "manual");
        }}
      >
        <div>
          <label className={labelClassName} htmlFor="code">
            Código de la misión
          </label>
          <input
            autoCapitalize="characters"
            autoComplete="off"
            className={`${fieldClassName} text-center font-mono text-2xl uppercase tracking-[0.3em]`}
            id="code"
            maxLength={9}
            onChange={(event) => setCode(event.target.value)}
            placeholder="XXXX-XXXX"
            spellCheck={false}
            value={code}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton className="sm:w-auto" pending={pending && !preview} pendingLabel="Verificando…" type="submit">
            Verificar código
          </SubmitButton>
          {scanning ? (
            <button className={secondaryButtonClassName} onClick={stopCamera} type="button">
              Cerrar cámara
            </button>
          ) : (
            <button className={secondaryButtonClassName} onClick={() => void startCamera()} type="button">
              Escanear QR
            </button>
          )}
        </div>
      </form>

      {scanning ? (
        <video aria-label="Vista de la cámara para escanear el QR" className="pixel-frame aspect-square w-full max-w-sm bg-black object-cover" muted playsInline ref={videoRef} />
      ) : null}

      {preview ? (
        <section className="pixel-frame bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Misión {formatCode(code)}</p>
          <h2 className="mt-2 font-display text-3xl">{preview.name}</h2>
          {preview.description ? <p className="mt-2 text-slate-600">{preview.description}</p> : null}
          <p className="mt-4 font-score text-4xl text-[var(--accent-strong)]">+{preview.points} pts</p>
          <p className="mt-1 text-xs text-slate-500">Vigente hasta {dateFormat.format(new Date(preview.expires_at))}</p>
          {blocked ? (
            <p className="mt-4 font-bold text-red-700">{blocked}</p>
          ) : (
            <SubmitButton className="mt-6 sm:w-auto" onClick={redeem} pending={pending} pendingLabel="Canjeando…" type="button">
              Confirmar canje
            </SubmitButton>
          )}
        </section>
      ) : null}
    </div>
  );
}

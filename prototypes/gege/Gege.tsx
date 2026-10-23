import React from "react";
import type { AgentRole } from "../../src/garden-gege/contracts";

export const roleColors: Record<AgentRole, string> = {
  cueilleur: "#8caf64",
  tresseur: "#d8b069",
  enlumineur: "#c78bb5",
  passeur: "#6ec5c4",
  greffeur: "#c88b62",
  jardinier: "#8b9d66",
  semeur: "#9fa9de",
};

/** Shared hamster silhouette for the garden, Gérard and every inspector portrait. */
export function Gege({
  role = "jardinier",
  chief = false,
}: {
  role?: AgentRole;
  chief?: boolean;
}) {
  const color = chief ? "#dcb46e" : roleColors[role];
  return (
    <svg viewBox="0 0 84 96" aria-hidden="true" data-character="hamster">
      <ellipse cx="42" cy="89" rx="29" ry="5" fill="#051f28" opacity=".4" />
      {/* Rounded body, short paws and separate round ears remain visible with every outfit. */}
      <ellipse cx="42" cy="66" rx="23" ry="23" fill="#bf8a54" />
      <ellipse cx="42" cy="69" rx="17" ry="19" fill="#f2ddaf" />
      <ellipse cx="29" cy="87" rx="9" ry="5" fill="#e7b19a" />
      <ellipse cx="55" cy="87" rx="9" ry="5" fill="#e7b19a" />
      <path d="M25 52q17 9 34 0l4 27q-21 12-42 0Z" fill={color} />
      {chief ? (
        <path d="M35 54l7 11 7-11v29H35Z" fill="#f2ddaf" />
      ) : (
        <path
          d="M29 53v12h26V53M32 69h20v9H32Z"
          fill="none"
          stroke="#f2ddaf"
          strokeWidth="2"
          opacity=".7"
        />
      )}
      <ellipse
        cx="19"
        cy="65"
        rx="7"
        ry="12"
        fill="#c99760"
        transform="rotate(19 19 65)"
      />
      <ellipse
        cx="65"
        cy="65"
        rx="7"
        ry="12"
        fill="#c99760"
        transform="rotate(-19 65 65)"
      />
      <ellipse cx="18" cy="73" rx="6" ry="5" fill="#eed0ae" />
      <ellipse cx="66" cy="73" rx="6" ry="5" fill="#eed0ae" />
      <circle cx="22" cy="15" r="11" fill="#c99760" />
      <circle cx="62" cy="15" r="11" fill="#c99760" />
      <circle cx="22" cy="15" r="6.5" fill="#dfa49c" />
      <circle cx="62" cy="15" r="6.5" fill="#dfa49c" />
      <ellipse cx="42" cy="35" rx="27" ry="25" fill="#d9ad70" />
      <path d="M35 12q6-9 11 0q-1-7 6-6" fill="#d9ad70" />
      {/* Full cheek pouches and a small muzzle define the face. */}
      <ellipse cx="26" cy="43" rx="13" ry="12" fill="#f3e3bd" />
      <ellipse cx="58" cy="43" rx="13" ry="12" fill="#f3e3bd" />
      <ellipse cx="42" cy="48" rx="15" ry="11" fill="#f3e3bd" />
      <ellipse cx="31" cy="32" rx="3.4" ry="4.5" fill="#263637" />
      <ellipse cx="53" cy="32" rx="3.4" ry="4.5" fill="#263637" />
      <circle cx="32" cy="30" r="1.2" fill="#fff9e9" />
      <circle cx="54" cy="30" r="1.2" fill="#fff9e9" />
      <ellipse cx="23" cy="44" rx="4" ry="2.3" fill="#e6b2a1" opacity=".65" />
      <ellipse cx="61" cy="44" rx="4" ry="2.3" fill="#e6b2a1" opacity=".65" />
      <path d="M38 41q4-4 8 0l-4 4Z" fill="#ac7774" />
      <path
        d="M42 45v3m0 0q-4 4-7 0m7 0q4 4 7 0"
        fill="none"
        stroke="#986b55"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M38 50h3v4h-3zm5 0h3v4h-3Z" fill="#fffae8" />
      <path
        d="M22 42 7 39m15 7L6 47m56-5 15-3m-15 7 16 1"
        stroke="#a47b59"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {chief && (
        <g>
          <g fill="none" stroke="#866a48" strokeWidth="1.4">
            <circle cx="31" cy="32" r="7" />
            <circle cx="53" cy="32" r="7" />
            <path d="M38 31h8" />
          </g>
          <circle cx="54" cy="69" r="5" fill="#f4df9f" stroke="#94723e" />
          <path d="m54 65 2 6-4-2Z" fill="#437b70" />
          <path
            d="M12 66v-6q6-7 12 0v6"
            stroke="#b69b62"
            fill="none"
            strokeWidth="2"
          />
          <rect
            x="12"
            y="66"
            width="12"
            height="15"
            rx="3"
            fill="#e8cd82"
            stroke="#987844"
            strokeWidth="2"
          />
          <path d="M18 69v9" stroke="#fff2bd" strokeWidth="3" />
        </g>
      )}
      {!chief && role === "cueilleur" && (
        <g>
          <path
            d="M7 72q10-15 21 0"
            fill="none"
            stroke="#ac7c43"
            strokeWidth="2"
          />
          <path
            d="M6 72h23l-3 14H9Z"
            fill="#c99b5f"
            stroke="#916b3f"
            strokeWidth="1.5"
          />
          <path
            d="M8 77h19M9 82h17m-11-9 1 12m7-12-1 12"
            stroke="#ead3a0"
            strokeWidth="1"
          />
          <path
            d="M18 72v-9m0 6q-11-1-7-8 8 0 7 8m0-1q9-11 13-5-2 8-13 5"
            fill="#6d9c61"
          />
        </g>
      )}
      {!chief && role === "tresseur" && (
        <g>
          <rect
            x="5"
            y="64"
            width="23"
            height="21"
            rx="2"
            fill="#f4e6bd"
            stroke="#9e804d"
            strokeWidth="1.5"
          />
          <path
            d="M16 65v19m-7-14h4m-4 4h4m6-4h5m-5 4h5m-5 4h4"
            stroke="#a58c65"
            strokeWidth="1.2"
          />
          <path d="m64 78 9-22" stroke="#d6ac62" strokeWidth="4" />
          <path d="m63 80 2-7 3 2Z" fill="#304641" />
        </g>
      )}
      {!chief && role === "enlumineur" && (
        <g>
          <path d="M30 17q12-13 25 0Z" fill={color} />
          <path d="m43 11 2-5" stroke="#915d85" strokeWidth="2" />
          <ellipse
            cx="17"
            cy="76"
            rx="12"
            ry="9"
            fill="#d6b582"
            transform="rotate(-22 17 76)"
          />
          <circle cx="12" cy="73" r="2.5" fill="#83b5aa" />
          <circle cx="19" cy="71" r="2.5" fill="#cb8bac" />
          <circle cx="22" cy="78" r="2.5" fill="#f0d28c" />
          <path d="m65 78 6-20" stroke="#c7a878" strokeWidth="3" />
          <path d="m68 60 3-10q7 4 2 11Z" fill="#89bcb3" />
        </g>
      )}
      {!chief && role === "passeur" && (
        <g>
          <path d="m28 54 31 28" stroke="#6d5842" strokeWidth="4" />
          <rect x="48" y="70" width="19" height="14" rx="3" fill="#b39362" />
          <path d="M49 73h17l-8 5Z" fill="#dcc89c" />
          <path d="m15 61-5 26" stroke="#a78a5a" strokeWidth="3" />
          <ellipse
            cx="10"
            cy="85"
            rx="4"
            ry="7"
            fill="#ceb784"
            transform="rotate(12 10 85)"
          />
        </g>
      )}
      {!chief && role === "greffeur" && (
        <g>
          <path d="M22 22h40" stroke="#745b44" strokeWidth="3" />
          <g fill="#a2c8b8" stroke="#85654a" strokeWidth="2">
            <rect x="26" y="17" width="12" height="9" rx="3" />
            <rect x="46" y="17" width="12" height="9" rx="3" />
          </g>
          <path
            d="m65 82 6-17"
            stroke="#b8c5b6"
            strokeWidth="5"
            strokeLinecap="round"
          />
          <path d="m68 65-3-6 3-5 1 6 5 1 4-5 1 7-6 5Z" fill="#b8c5b6" />
          <path d="M28 78h26" stroke="#71563e" strokeWidth="4" />
        </g>
      )}
      {!chief && role === "jardinier" && (
        <g>
          <path d="M31 56h22v26H31Z" fill="#bac28c" />
          <path d="M36 69h12v8H36Z" fill="#738a58" />
          <path
            d="M13 85V59m-7 0h14m-14 0v-6m5 6v-6m5 6v-6m5 6v-6"
            stroke="#b9a67b"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      )}
      {!chief && role === "semeur" && (
        <g>
          <path d="m9 69 17 1 3 16H7Z" fill="#c6b58b" />
          <path d="M8 72h20" stroke="#887b52" strokeWidth="2" />
          <path
            d="M17 82v-8m0 5q-7-2-6-6 6 1 6 6m0-1q2-6 7-6-1 6-7 6"
            fill="#6c8f5a"
          />
          <ellipse
            cx="69"
            cy="77"
            rx="2"
            ry="3"
            fill="#e8ca89"
            transform="rotate(35 69 77)"
          />
          <ellipse cx="75" cy="82" rx="2" ry="3" fill="#e8ca89" />
        </g>
      )}
    </svg>
  );
}

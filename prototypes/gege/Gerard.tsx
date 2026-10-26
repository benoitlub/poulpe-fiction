import React, { useId } from "react";

/** Gérard, the octopus coordinator. Identity only: no inferred activity or decisions. */
export function Gerard() {
  const mantle = useId();
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" data-character="octopus">
      <defs>
        <linearGradient id={mantle} x2="0.8" y2="1">
          <stop stopColor="#80cec0" />
          <stop offset="1" stopColor="#337d7b" />
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="108" rx="52" ry="7" fill="#082832" opacity=".5" />
      <g fill="none" strokeLinecap="round" strokeWidth="11">
        {[
          "M43 72Q10 65 12 89Q14 98 23 90",
          "M48 78Q16 82 23 103Q29 112 34 101",
          "M53 82Q32 98 43 110Q50 115 51 103",
          "M58 85Q49 105 58 111",
          "M62 85Q71 106 65 112",
          "M67 82Q91 99 80 109Q73 115 73 103",
          "M73 78Q106 83 99 102Q93 111 88 101",
          "M78 72Q112 65 109 89Q107 98 98 90",
        ].map((d, i) => (
          <path
            key={d}
            d={d}
            stroke={i % 2 ? "#72bcae" : "#458f8b"}
            data-tentacle={i + 1}
          />
        ))}
      </g>
      <path
        d="M31 55C25 8 95 5 90 54Q90 85 61 89Q30 86 31 55Z"
        fill={`url(#${mantle})`}
        stroke="#9dd9c0"
        strokeWidth="1.5"
      />
      <path
        d="M39 31Q44 19 55 20"
        fill="none"
        stroke="#b5e8d1"
        strokeWidth="4"
        strokeLinecap="round"
        opacity=".6"
      />
      <path d="M34 71Q61 85 87 71L85 82Q62 94 36 82Z" fill="#cfb477" />
      <g fill="#f1e2b4" stroke="#906d45" strokeWidth="2">
        <circle cx="47" cy="53" r="11" />
        <circle cx="75" cy="53" r="11" />
        <path d="M58 52h6M36 50l-5-3M86 50l5-3" fill="none" />
      </g>
      <g fill="#163e43">
        <ellipse cx="49" cy="53" rx="3" ry="5" />
        <ellipse cx="73" cy="53" rx="3" ry="5" />
      </g>
      <g fill="#fff6d5">
        <circle cx="50" cy="51" r="1" />
        <circle cx="74" cy="51" r="1" />
      </g>
      <path
        d="M54 68q7 6 14-1"
        fill="none"
        stroke="#205252"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle
        cx="61"
        cy="83"
        r="7"
        fill="#f3d99c"
        stroke="#916d3f"
        strokeWidth="1.5"
      />
      <path d="m61 77 3 9-6-3Z" fill="#337d7b" />
      <g fill="#c0ddbd">
        <circle cx="22" cy="96" r="2" />
        <circle cx="40" cy="105" r="2" />
        <circle cx="82" cy="105" r="2" />
        <circle cx="100" cy="96" r="2" />
      </g>
    </svg>
  );
}

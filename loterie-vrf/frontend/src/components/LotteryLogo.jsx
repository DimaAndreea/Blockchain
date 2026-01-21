export default function LotteryLogo({ size = 140 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      className="lotteryLogo"
    >
      {/* outer glow */}
      <circle
        cx="100"
        cy="100"
        r="92"
        stroke="currentColor"
        strokeOpacity="0.15"
        strokeWidth="2"
      />

      {/* trophy */}
      <path
        d="M65 55h70v20c0 22-18 40-35 40s-35-18-35-40V55Z"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M55 65h-15c0 20 15 35 35 35"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M145 65h15c0 20-15 35-35 35"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* stem */}
      <path
        d="M100 115v25"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
      />

      {/* base */}
      <rect
        x="70"
        y="140"
        width="60"
        height="18"
        rx="6"
        stroke="currentColor"
        strokeWidth="4"
      />

      {/* coin */}
      <circle
        cx="140"
        cy="45"
        r="14"
        stroke="currentColor"
        strokeWidth="3"
      />
      <text
        x="140"
        y="50"
        textAnchor="middle"
        fontSize="14"
        fontWeight="900"
        fill="currentColor"
      >
        $
      </text>

      {/* spark */}
      <path
        d="M45 40l6 12 12 6-12 6-6 12-6-12-12-6 12-6 6-12Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

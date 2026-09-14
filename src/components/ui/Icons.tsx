import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const shared = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const ShieldHeartIcon = (props: IconProps) => (
  <svg {...shared} {...props}>
    <path d="M12 21s7-3.5 7-9V5l-7-2.5L5 5v7c0 5.5 7 9 7 9Z" />
    <path d="M12 15.6 8.7 12.4a2.1 2.1 0 0 1 3-3l.3.3.3-.3a2.1 2.1 0 0 1 3 3L12 15.6Z" />
  </svg>
)

export const MicIcon = (props: IconProps) => (
  <svg {...shared} {...props}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6" />
  </svg>
)

export const ArrowIcon = (props: IconProps) => (
  <svg {...shared} {...props}>
    <path d="M5 12h14M14 7l5 5-5 5" />
  </svg>
)

export const CheckIcon = (props: IconProps) => (
  <svg {...shared} {...props}>
    <path d="m5 12 4 4L19 6" />
  </svg>
)

export const SparkIcon = (props: IconProps) => (
  <svg {...shared} {...props}>
    <path d="m12 3 1.2 4.1a5.2 5.2 0 0 0 3.6 3.6L21 12l-4.2 1.3a5.2 5.2 0 0 0-3.6 3.6L12 21l-1.2-4.1a5.2 5.2 0 0 0-3.6-3.6L3 12l4.2-1.3a5.2 5.2 0 0 0 3.6-3.6L12 3Z" />
  </svg>
)

export const UsersIcon = (props: IconProps) => (
  <svg {...shared} {...props}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 4.7a3 3 0 0 1 0 6M17 14a5 5 0 0 1 3.5 5" />
  </svg>
)

export const ClipboardIcon = (props: IconProps) => (
  <svg {...shared} {...props}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5V3h6v1.5M9 10h6M9 14h6" />
  </svg>
)

export const AlertIcon = (props: IconProps) => (
  <svg {...shared} {...props}>
    <path d="M12 3 2.8 20h18.4L12 3Z" />
    <path d="M12 9v5M12 17.5v.1" />
  </svg>
)

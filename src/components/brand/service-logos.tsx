import { cn } from "@/lib/utils";

/**
 * Logos de los servicios externos (Settings → Conexiones), a todo color.
 * Los trazos vienen de cada marca (Jotform de su sitio; Google, Google Drive
 * y Vercel de la colección "logos" de Iconify; feriados.io de su favicon).
 * Solo se usan para identificar la conexión.
 */

type LogoProps = { className?: string };
const base = "size-6 shrink-0";

export function JotformLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 60 66" aria-hidden="true" className={cn(base, className)}>
      <path
        d="M16.43 62.73c1.24 1.2.36 3.27-1.4 3.27H3.95A3.9 3.9 0 010 62.16V51.44c0-1.72 2.13-2.57 3.38-1.36l13.05 12.65z"
        className="fill-[#0A1551] dark:fill-white"
      />
      <path
        d="M33.72 63.56a8.3 8.3 0 010-11.78l11.82-11.74a8.42 8.42 0 0111.86 0 8.3 8.3 0 010 11.78L45.58 63.56a8.42 8.42 0 01-11.86 0z"
        fill="#FFB629"
      />
      <path
        d="M2.5 34.05a8.3 8.3 0 010-11.78L22.39 2.5a8.42 8.42 0 0111.86 0 8.3 8.3 0 010 11.78l-19.9 19.77a8.42 8.42 0 01-11.85 0z"
        fill="#0099FF"
      />
      <path
        d="M18.76 48.15a8.3 8.3 0 010-11.78l26.87-26.7a8.42 8.42 0 0111.86 0 8.3 8.3 0 010 11.78l-26.87 26.7a8.42 8.42 0 01-11.86 0z"
        fill="#FF6100"
      />
    </svg>
  );
}

export function GoogleDriveLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 256 229"
      aria-hidden="true"
      className={cn(base, className)}
    >
      <path
        fill="#0066da"
        d="m19.354 196.034l11.29 19.5c2.346 4.106 5.718 7.332 9.677 9.678q17.009-21.591 23.68-33.137q6.77-11.717 16.641-36.655q-26.604-3.502-40.32-3.502q-13.165 0-40.322 3.502c0 4.545 1.173 9.09 3.519 13.196z"
      />
      <path
        fill="#ea4335"
        d="M215.681 225.212c3.96-2.346 7.332-5.572 9.677-9.677l4.692-8.064l22.434-38.855a26.57 26.57 0 0 0 3.518-13.196q-27.315-3.502-40.247-3.502q-13.899 0-40.248 3.502q9.754 25.075 16.422 36.655q6.724 11.683 23.752 33.137"
      />
      <path
        fill="#00832d"
        d="M128.001 73.311q19.68-23.768 27.125-36.655q5.996-10.377 13.196-33.137C164.363 1.173 159.818 0 155.126 0h-54.25C96.184 0 91.64 1.32 87.68 3.519q9.16 26.103 15.544 37.154q7.056 12.213 24.777 32.638"
      />
      <path
        fill="#2684fc"
        d="M175.36 155.42H80.642l-40.32 69.792c3.958 2.346 8.503 3.519 13.195 3.519h148.968c4.692 0 9.238-1.32 13.196-3.52z"
      />
      <path
        fill="#00ac47"
        d="M128.001 73.311L87.681 3.52c-3.96 2.346-7.332 5.571-9.678 9.677L3.519 142.224A26.57 26.57 0 0 0 0 155.42h80.642z"
      />
      <path
        fill="#ffba00"
        d="m215.242 77.71l-37.243-64.514c-2.345-4.106-5.718-7.331-9.677-9.677l-40.32 69.792l47.358 82.109h80.496c0-4.546-1.173-9.09-3.519-13.196z"
      />
    </svg>
  );
}

export function GoogleLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 256 262"
      aria-hidden="true"
      className={cn(base, className)}
    >
      <path
        fill="#4285f4"
        d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
      />
      <path
        fill="#34a853"
        d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
      />
      <path
        fill="#fbbc05"
        d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
      />
      <path
        fill="#eb4335"
        d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
      />
    </svg>
  );
}

/** El triángulo de Vercel: negro en claro, blanco en oscuro. */
export function VercelLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 256 222"
      aria-hidden="true"
      className={cn(base, "fill-black dark:fill-white", className)}
    >
      <path d="m128 0l128 221.705H0z" />
    </svg>
  );
}

export function FeriadosLogo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={cn(base, className)}
    >
      <rect width="200" height="200" rx="34" fill="#00C853" />
      <rect x="42" y="42" width="34" height="34" rx="4" fill="#fff" />
      <rect x="88" y="42" width="78" height="34" rx="4" fill="#fff" />
      <rect x="42" y="88" width="34" height="34" rx="4" fill="#fff" />
      <rect x="88" y="88" width="50" height="34" rx="4" fill="#fff" />
      <rect x="42" y="134" width="34" height="34" rx="4" fill="#fff" />
    </svg>
  );
}

/** Alegra: su ícono oficial (favicon de 48 px, el único formato que publica). */
export function AlegraLogo({ className }: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- ícono pequeño embebido, sin pasar por next/image.
    <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAXSSURBVHgBzVrNbxtVEJ99Dm2IaOo2EUqQ2jiIj0ogJUGilCIUV+RUlcS+FDglbuDAKeXIKc5fQHJEoHwcOdkpCIGElAQkhISEXQkQVaXWCSqJaEMdqCriJrvM7+1usrter/fDCf5Jlu23z7szb34z896MFWoEcnNxIjVFgvpIoQRp1M+jceNlokSKUiJNK5JK14kqy5R+v0QRoVBYQOgWmmCBkvIV7vGsjDYTRZngCpiCq+pVsq9wNCg0T7uVqaCKBFPg87nJhgvuhBBZejMz5Xe6PwVycwkSWo5I66fDQYnUygU/1hD1JtAXs6Mk1MIhCg/wgh0pUO7TVL2J3gqAMrvaPB0kZWojTkLJSRk8UJtCOt+z1Azw8At3BWA6aN9MiCljdOnKgnO4WgHpsOD8/0IbL5TZsQecjl3tA0JdouYTHmCfOFrFCrsCusMk6CCe/tgRig6OhLlPstaRfQrp1LlNDQIETnWdpsHOp+T7zK1fKHujYLteflShEGAqiV5KZ8r40rI3rKiTFAEQqP/4SRrp6qH+9g5KdnbZrpcePrB9Hzv1LE08/QJNsVLzv9+kAGB672A3kMUX3QIRV/+jF1+RAnnRJFP4zibo0msXKdmhKwnlAiqyZwXDB9QkRcDi+mogjmOuKTyQaHuC5gZep9tDl23jXrcwrGA4sVAmKAKWNzeqKFL1RIuC/e0na84r/v0X+UIsNog3IekTcJ+D1XICTuoFmwLHO6quYwEufP+lf8fGGYS39iIofUy+X2UHtAL89Xp4D9PEBJzdifSP39S1YjUepUSQ1bcKDkWsVIDwUzd+qvnbExYL9LQds12DAxe3dOrAH3Jn3/DpC6JfUEz0+Zgpbzz5/IBtLHd2iOIt+4JN3/q15ir2tXe4jmO+mR8QVguDKc4bPZTq7iE/Ygk+kyb8zFw6f1EqYfu1sVpWZArfuj+J55o0Wn34z964aTUszjRb1fSVUbZ2XQilT8gqQh3g5k7hTSQ7uyWdTCAi1XLodJe+qlZfwXxQM2tYF9cQiTBe65kWxFvqzYA5sw7qOAG/0H1ApwIogYzsFGCEtxTTrFye8wbosnxPD7+T5wdkEFhYuykFDwBvBSCAdXW9YCoJJaAMQqKTdrAWfAYrjDkrm+vSWUG7gILvIUbvjCCjtbpdzL085BryagECAissDARc3FiVFrTmgG11l7768w51tz5Ovz3YkoLjPSwEV9HKbhfAe+eGzA9gCTNamcnJGplAHVhl2vCTkDtSE6UYvT2c5JLfGesoHpDnEBkWsAS20F/fvSOFh1MrxnhrLCbzxwyH3PJOJZoCXKaM0VvDr7IC56zjuClCHVJ+2INIV2ubpM+WJaossKMioZkxfnFjjSJBo0W2wEgXL09V/QUPxcpFUSRuCJvs6JYOC2vkWWgoku6Gbxz1v3lzVUD5WJG1TqHerzd37NQzzO2X/MTmmsivr/Gi/GyLOLhf8D2QAbXSqx9ors0u+a0wQ5HR08/53be7AgIvs0Wu8/6nuLW55wvBFOHK9siVgZj8fPlSL/tB0s/PYHJQwOQzaBCUXvrxs4POnXiSzhyL0/buDv1w/y79yyHWN1T6kD67VjSPlHHjSBmqnAJrIF/gAA9KuB1YsMLmNmHl3h9y92kmtFBg+qBGZKlKcLlCiEgHeydMfwnN8VpAL2F4PIOPlrpQyzSRe1ILCwjecOEBNEIM7CuAOouqzlCzQ1VtXZzq2uji7GH3AoKgRCPjvdaB6tqoqqSpwVRqEMqya+NAtQLpDLd36ANqNqhaxq3l5N6hSY/PS641CyTv3827XfJu8h1AaA0MKfx72VqX63cp9W7NHB1+z6AsqQw2eCBAm1U2PhJ0KEAHfzvtp80arNF98JTSc5EHZZwI81eDBKdCVkQZpcbBSKK8GzAaF34R5c8eCVlXVbQJ3smGS3yatsyvlTCCmwivgBWmMsjgMerjZJhwFMzKsnggtCLt0qrkOIl8WKGt+A98bYEzLSXdhAAAAABJRU5ErkJggg==" alt="" aria-hidden="true" className={cn(base, "rounded-full", className)} />
  );
}

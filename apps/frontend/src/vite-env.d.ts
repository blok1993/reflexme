/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Полный префикс API, например `https://твой-api.onrender.com/api/v1` */
  readonly VITE_API_BASE_URL?: string;
  /** `"true"` — маршруты в хеше (`/#/checkin`), обновление страницы без rewrite на сервере */
  readonly VITE_USE_HASH_ROUTER?: string;
}

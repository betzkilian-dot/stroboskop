/** Ein Platz fuer das voll aufgeloeste Stroboskopbild (nach Zuschnitt/Drehung), damit Optionswechsel im Teilen-Dialog nicht neu rechnen. */
export interface StrobeImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export class StrobeCache {
  #key: string | null = null;
  #promise: Promise<StrobeImage> | null = null;

  /** Liefert den Eintrag zu `key`; laeuft schon dieselbe Berechnung, wird sie geteilt. Fehler/Abbruch vergiften den Cache nicht; ein Mitnutzer eines abgebrochenen Laufs rechnet einmal selbst neu. */
  get(key: string, build: () => Promise<StrobeImage>, shouldRetry: () => boolean = () => true, retry = true): Promise<StrobeImage> {
    if (this.#promise && this.#key === key) {
      // Wer sich an eine laufende Berechnung haengt, die dann abbricht (z. B. vom Dialog verdraengt), startet sie einmal selbst neu.
      return retry ? this.#promise.catch((e) => (shouldRetry() ? this.get(key, build, shouldRetry, false) : Promise.reject(e))) : this.#promise;
    }
    const promise = build();
    this.#key = key;
    this.#promise = promise;
    promise.catch(() => {
      if (this.#promise === promise) this.clear();
    });
    return promise;
  }

  /** Verwirft den Eintrag (neues Video, dispose); ein noch laufender Render wird danach nicht mehr eingetragen. */
  clear(): void {
    this.#key = null;
    this.#promise = null;
  }
}

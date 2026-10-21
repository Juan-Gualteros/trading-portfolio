import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TradeService {
  private apiUrl = 'http://localhost:3000/api/trades';

  constructor(private http: HttpClient) { }

  getTrades(accountId?: number): Observable<any> {
    const url = accountId ? `${this.apiUrl}?accountId=${accountId}` : this.apiUrl;
    return this.http.get(url);
  }

  getMetrics(accountId?: number): Observable<any> {
    const url = accountId ? `${this.apiUrl}/metrics?accountId=${accountId}` : `${this.apiUrl}/metrics`;
    return this.http.get(url);
  }

  addTrade(tradeData: any): Observable<any> {
    return this.http.post(this.apiUrl, tradeData);
  }

  updateTrade(id: number, tradeData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, tradeData);
  }

  deleteTrade(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  getPsychologicalAnalysis(accountId?: number, forceRefresh: boolean = false): Observable<any> {
    let url = accountId ? `${this.apiUrl}/psychological-analysis?accountId=${accountId}` : `${this.apiUrl}/psychological-analysis`;
    if (forceRefresh) {
      url += (url.includes('?') ? '&' : '?') + 'forceRefresh=true';
    }
    return this.http.get(url);
  }

  getQuantitativeAnalysis(accountId?: number): Observable<any> {
    const url = accountId ? `${this.apiUrl}/quantitative-analysis?accountId=${accountId}` : `${this.apiUrl}/quantitative-analysis`;
    return this.http.get(url);
  }

  importCSV(accountId: number, trades: any[]): Observable<any> {
    return this.http.post(`${this.apiUrl}/import-csv`, { accountId, trades });
  }

  detectEmotion(tradeData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/detect-emotion`, tradeData);
  }

  getFxRates(): Observable<any> {
    return this.http.get('http://localhost:3000/api/fx-rates');
  }
}

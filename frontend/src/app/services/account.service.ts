import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  private apiUrl = 'http://localhost:3000/api/accounts';

  constructor(private http: HttpClient) { }

  getAccounts(): Observable<any> {
    return this.http.get(this.apiUrl);
  }

  addAccount(accountData: any): Observable<any> {
    return this.http.post(this.apiUrl, accountData);
  }

  updateAccount(id: number, accountData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, accountData);
  }

  setDefaultAccount(id: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}/set-default`, {});
  }

  deleteAccount(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}

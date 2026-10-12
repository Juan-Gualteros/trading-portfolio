import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  isLoggedIn = false;
  username = '';

  constructor(public authService: AuthService) {}

  ngOnInit(): void {
    this.authService.isAuthenticated$.subscribe(auth => {
      this.isLoggedIn = auth;
      if (auth) {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            this.username = JSON.parse(userStr).username;
          } catch(e) {}
        }
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }
}

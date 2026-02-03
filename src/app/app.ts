import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LoginPage } from "./modules/auth/login-page/login-page";
import { ChatList } from "./modules/home/chat-list/chat-list";

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ChatList],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('chat-app');
}

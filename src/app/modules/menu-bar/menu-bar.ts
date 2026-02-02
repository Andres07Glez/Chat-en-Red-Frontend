import { Component } from '@angular/core';

@Component({
  selector: 'app-menu-bar',
  //standalone: true,
  imports: [],
  templateUrl: './menu-bar.html',
  styleUrls: ['./menu-bar.css']
})
export class menubar {
  perfilAbierto = false;

  togglePerfil() {
    this.perfilAbierto = !this.perfilAbierto;
  }
}

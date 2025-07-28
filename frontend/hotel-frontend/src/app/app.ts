import { Component } from '@angular/core';
import { HotelSelectionComponent } from './hotel-selection/hotel-selection';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HotelSelectionComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {}

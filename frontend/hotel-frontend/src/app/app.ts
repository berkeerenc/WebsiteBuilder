import { Component } from '@angular/core';
import { HotelRegistrationComponent } from './hotel-registration/hotel-registration';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [HotelRegistrationComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent {}

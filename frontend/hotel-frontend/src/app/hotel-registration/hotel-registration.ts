import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-hotel-registration',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './hotel-registration.html',
  styleUrls: ['./hotel-registration.css'],
  providers: [FormBuilder]
})
export class HotelRegistrationComponent {
  hotelForm: FormGroup;
  logoFile: File | null = null;
  themes = ['classic', 'modern', 'elegant']; // Replace with API call later
  successMessage = '';
  errorMessage = '';
  siteUrl = '';
  loading = false;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.hotelForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      address: ['', Validators.required],
      theme: ['', Validators.required]
    });
  }

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.logoFile = input.files[0];
    }
  }

  onSubmit() {
    if (this.hotelForm.valid) {
      this.loading = true;
      const formData = new FormData();
      formData.append('name', this.hotelForm.value.name);
      formData.append('email', this.hotelForm.value.email);
      formData.append('phone', this.hotelForm.value.phone);
      formData.append('address', this.hotelForm.value.address);
      formData.append('theme', this.hotelForm.value.theme);
      if (this.logoFile) {
        formData.append('logo', this.logoFile);
      }
      this.http.post<{ hotel: any, siteUrl: string }>('http://localhost:5000/api/hotels', formData).subscribe({
        next: (response) => {
          this.successMessage = 'Hotel registered successfully!';
          this.errorMessage = '';
          this.siteUrl = 'http://localhost:5000' + response.siteUrl;
          this.hotelForm.reset();
          this.logoFile = null;
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = 'Error registering hotel: ' + (err.error?.message || err.message);
          this.successMessage = '';
          this.siteUrl = '';
          this.loading = false;
        }
      });
    }
  }
}
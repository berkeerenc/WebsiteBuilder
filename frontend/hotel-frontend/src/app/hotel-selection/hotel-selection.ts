import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface Hotel {
  _id: string;
  name: string;
  logoUrl?: string;
  description?: string;
  contact?: {
    phone?: string;
    address?: string;
    email?: string;
  };
}

@Component({
  selector: 'app-hotel-selection',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './hotel-selection.html',
  styleUrls: ['./hotel-selection.css']
})
export class HotelSelectionComponent implements OnInit {
  hotels: Hotel[] = []; // Initialize as empty array
  selectedHotel: Hotel | null = null;
  siteCreationForm: FormGroup;
  addHotelForm: FormGroup;
  creationMethod: 'template' | 'url' = 'template';
  themes = ['classic', 'modern', 'elegant', 'luxury', 'minimal'];
  loading = false;
  addingHotel = false;
  showAddHotelForm = false;
  successMessage = '';
  errorMessage = '';
  generatedSiteUrl = '';

  constructor(
    private fb: FormBuilder, 
    private http: HttpClient,
    private cdr: ChangeDetectorRef
  ) {
    this.siteCreationForm = this.fb.group({
      theme: ['', Validators.required],
      targetUrl: ['', [Validators.required, Validators.pattern('https?://.+')]]
    });
    
    this.addHotelForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      email: [''],
      phone: [''],
      address: ['']
    });
  }

  ngOnInit() {
    console.log('Component initialized, hotels array length:', this.hotels.length);
    this.loadHotels();
    // Initialize form validation for the default creation method
    this.setCreationMethod('template');
  }

  loadHotels() {
    console.log('Loading hotels...');
    this.http.get<Hotel[]>('http://localhost:5000/api/hotels').subscribe({
      next: (hotels) => {
        console.log('Hotels loaded:', hotels);
        console.log('Hotels array length:', hotels.length);
        this.hotels = hotels;
        console.log('Component hotels array length:', this.hotels.length);
        this.cdr.detectChanges(); // Force change detection
      },
      error: (err) => {
        console.error('Error loading hotels:', err);
        this.errorMessage = 'Failed to load hotels: ' + err.message;
        this.cdr.detectChanges();
      }
    });
  }

  trackByHotelId(index: number, hotel: Hotel): string {
    return hotel._id;
  }

  addNewHotel() {
    if (this.addHotelForm.invalid) {
      return;
    }

    this.addingHotel = true;
    this.errorMessage = '';

    const hotelData = {
      ...this.addHotelForm.value,
      theme: 'classic' // Default theme
    };

    console.log('Adding new hotel:', hotelData);

    this.http.post('http://localhost:5000/api/hotels', hotelData).subscribe({
      next: (response: any) => {
        console.log('Hotel added successfully:', response);
        this.successMessage = 'Hotel added successfully!';
        this.showAddHotelForm = false;
        this.addHotelForm.reset();
        this.addingHotel = false;
        this.loadHotels(); // Reload the hotel list
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Error adding hotel:', err);
        this.errorMessage = 'Failed to add hotel: ' + (err.error?.message || err.message);
        this.addingHotel = false;
        this.cdr.detectChanges();
      }
    });
  }

  selectHotel(hotel: Hotel) {
    this.selectedHotel = hotel;
    this.successMessage = '';
    this.errorMessage = '';
    this.generatedSiteUrl = '';
  }

  setCreationMethod(method: 'template' | 'url') {
    this.creationMethod = method;
    this.successMessage = '';
    this.errorMessage = '';
    this.generatedSiteUrl = '';
    
    // Reset form values when switching methods
    this.siteCreationForm.reset();
    
    if (method === 'template') {
      this.siteCreationForm.get('targetUrl')?.clearValidators();
      this.siteCreationForm.get('theme')?.setValidators([Validators.required]);
      // Set default theme
      this.siteCreationForm.get('theme')?.setValue('classic');
    } else {
      this.siteCreationForm.get('theme')?.clearValidators();
      this.siteCreationForm.get('targetUrl')?.setValidators([Validators.required, Validators.pattern('https?://.+')]);
    }
    
    this.siteCreationForm.get('theme')?.updateValueAndValidity();
    this.siteCreationForm.get('targetUrl')?.updateValueAndValidity();
    
    console.log('Creation method set to:', method);
    console.log('Form valid:', this.siteCreationForm.valid);
    console.log('Form value:', this.siteCreationForm.value);
  }

  createSite() {
    console.log('Create site button clicked!');
    console.log('Selected hotel:', this.selectedHotel);
    console.log('Creation method:', this.creationMethod);
    console.log('Form value:', this.siteCreationForm.value);
    console.log('Form valid:', this.siteCreationForm.valid);
    
    if (!this.selectedHotel) {
      this.errorMessage = 'Please select a hotel first';
      console.log('No hotel selected');
      return;
    }

    if (this.siteCreationForm.invalid) {
      this.errorMessage = 'Please fill in all required fields';
      console.log('Form is invalid');
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.creationMethod === 'template') {
      // Use existing template endpoint
      const hotelId = this.selectedHotel._id;
      const endpoint = `http://localhost:5000/api/hotels/${hotelId}/create-from-template`;
      const payload = { theme: this.siteCreationForm.value.theme };

      console.log('Making template request to:', endpoint);
      console.log('With payload:', payload);

      this.http.post(endpoint, payload).subscribe({
        next: (response: any) => {
          console.log('Success response:', response);
          this.successMessage = response.message;
          this.generatedSiteUrl = 'http://localhost:5000' + response.siteUrl;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error creating site:', err);
          this.errorMessage = 'Failed to create site: ' + (err.error?.message || err.message);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    } else {
      // Use new direct clone endpoint with hotel data
      const endpoint = 'http://localhost:5000/api/sites/clone';
      const payload = {
        url: this.siteCreationForm.value.targetUrl,
        hotelData: {
          name: this.selectedHotel.name,
          phone: this.selectedHotel.contact?.phone || '',
          address: this.selectedHotel.contact?.address || '',
          email: this.selectedHotel.contact?.email || '',
          description: this.selectedHotel.description || '',
          logo: this.selectedHotel.logoUrl || ''
        }
      };

      console.log('Making clone request to:', endpoint);
      console.log('With payload:', payload);

      this.http.post(endpoint, payload).subscribe({
        next: (response: any) => {
          console.log('Success response:', response);
          this.successMessage = response.message;
          this.generatedSiteUrl = 'http://localhost:5000' + response.siteUrl;
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Error cloning site:', err);
          this.errorMessage = 'Failed to clone site: ' + (err.error?.message || err.message);
          this.loading = false;
          this.cdr.detectChanges();
        }
      });
    }
  }
} 
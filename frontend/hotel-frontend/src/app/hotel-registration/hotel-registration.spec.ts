import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HotelRegistration } from './hotel-registration';

describe('HotelRegistration', () => {
  let component: HotelRegistration;
  let fixture: ComponentFixture<HotelRegistration>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HotelRegistration]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HotelRegistration);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

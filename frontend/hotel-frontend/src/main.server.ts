import { renderApplication } from '@angular/platform-server';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app';
import { appConfig } from './app/app.config';

export default renderApplication(() => bootstrapApplication(AppComponent, appConfig), {
  document: '<!DOCTYPE html><html><head></head><body><app-root></app-root></body></html>'
});

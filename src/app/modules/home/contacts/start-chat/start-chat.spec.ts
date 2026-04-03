import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StartChat } from './start-chat';

describe('StartChat', () => {
  let component: StartChat;
  let fixture: ComponentFixture<StartChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StartChat]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StartChat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatMessagesDaisyComponent } from './chat-messages-daisy';

describe('ChatMessagesDaisyComponent', () => {
  let component: ChatMessagesDaisyComponent;
  let fixture: ComponentFixture<ChatMessagesDaisyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatMessagesDaisyComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatMessagesDaisyComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { menubar } from './menu-bar';


describe('menubar', () => {
    let component: menubar;
    let fixture: ComponentFixture<menubar>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({

            imports: [menubar]
        })
            .compileComponents();
        fixture = TestBed.createComponent(menubar);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});


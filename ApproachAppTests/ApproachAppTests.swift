import XCTest
@testable import ApproachApp

final class ApproachAppTests: XCTestCase {

    override func setUpWithError() throws {
        // Put setup code here. This method is called before the invocation of each test method in the class.
    }

    override func tearDownWithError() throws {
        // Put teardown code here. This method is called after the invocation of each test method in the class.
    }

    func testContentViewInitializes() throws {
        // Verify that ContentView can be instantiated without errors.
        let view = ContentView()
        XCTAssertNotNil(view)
    }

    func testPerformanceExample() throws {
        // Performance baseline for ContentView initialization.
        self.measure {
            _ = ContentView()
        }
    }

}

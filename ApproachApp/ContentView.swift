import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack {
            Image(systemName: "figure.walk")
                .imageScale(.large)
                .foregroundStyle(.tint)
            Text("Approach App")
                .font(.largeTitle)
                .fontWeight(.bold)
                .padding(.top, 8)
            Text("Built with Swift & SwiftUI")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
    }
}

#Preview {
    ContentView()
}
